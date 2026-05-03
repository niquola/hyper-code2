// In-process worker. Drains agents whose debounce window has elapsed.
// Multiple agents run concurrently — each one is its own promise; the loop
// claims as much work as is currently pending, then sleeps for new wakes.
//
// Per-agent serialisation is enforced by the atomic claim itself:
//
//   UPDATE agents SET run_state='running' WHERE id IN (SELECT … LIMIT 1) RETURNING id
//
// Two concurrent claims targeting the same `idle` row can't both win — SQLite's
// RETURNING semantics ensure exactly one statement gets the id. So we never
// need an in-memory `inflight` Map keyed by agent id; the DB is the lock.
//
// State on the agents row:
//   next_run_at + run_state + last_processed_msg_idx (cursor over USER msgs)
const MAX_IDLE_MS = 30_000;

function isAbortError(error: any) {
    const msg = String(error?.message ?? error ?? '');
    return msg.includes('aborted') || msg.includes('AbortError');
}

function loadAgent(ctx: Context, id: string): any {
    let a = (ctx.state as any).agent?.[id];
    if (a) return a;
    a = ctx.fns.session?.load?.(ctx, { id }) ?? null;
    if (a) {
        (ctx.state as any).agent ??= {};
        (ctx.state as any).agent[id] = a;
    }
    return a;
}

function waitForWork(ctx: Context, timeoutMs: number): Promise<void> {
    // Edge-triggered: if a wake fired between the loop's "decided to sleep"
    // and this call, workerWakePending is set — return immediately, don't
    // park on the condvar. Clears the flag.
    if ((ctx.state as any).workerWakePending) {
        (ctx.state as any).workerWakePending = false;
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        const set: Set<() => void> = ((ctx.state as any).workerWakeWaiters ??= new Set());
        let done = false;
        const onWake = () => { if (done) return; done = true; clearTimeout(t); set.delete(onWake); resolve(); };
        const t = setTimeout(() => { if (done) return; done = true; set.delete(onWake); resolve(); }, Math.max(0, timeoutMs));
        set.add(onWake);
    });
}

// Atomically claim ONE pending agent, returning its id (or null if none).
function claimOne(ctx: Context, now: number): string | null {
    const claimed = ctx.fns.db.select<any>(ctx, {
        sql: `UPDATE agents
            SET run_state      = 'running',
                run_started_at = ?,
                last_error     = NULL,
                updated_at     = ?
          WHERE id IN (
              SELECT id FROM agents
               WHERE run_state = 'idle'
                 AND next_run_at IS NOT NULL
                 AND next_run_at <= ?
                 AND archived_at IS NULL
               ORDER BY next_run_at ASC
               LIMIT 1
          )
          RETURNING id`,
        params: [now, now, now],
    });
    return claimed.length === 0 ? null : (claimed[0]!.id as string);
}

// Run one agent end-to-end. Mirrors what the old single-agent loop body did:
// frontier snapshot → run() → finally: advance cursor / reschedule / mark idle.
async function runOne(ctx: Context, agentId: string): Promise<void> {
    const agent = loadAgent(ctx, agentId);
    if (!agent) {
        const ts = Date.now();
        ctx.fns.db.exec(ctx, {
            sql: `UPDATE agents SET run_state = 'idle', last_error = ?, updated_at = ? WHERE id = ?`,
            params: ['agent not found at run-time', ts, agentId],
        });
        return;
    }

    // Snapshot USER-message frontier before run(). Cursor only advances on success,
    // and "did new messages arrive during the run" must mean new real user
    // messages — synthetic §result:* / §error:* user-rows are
    // excluded_from_cursor=1, assistant emissions are not 'user' role.
    const frontier = ctx.fns.db.select<any>(ctx, {
        sql: "SELECT COALESCE(MAX(idx), -1) AS max_idx FROM messages WHERE agent_id = ? AND role = 'user' AND excluded_from_cursor = 0",
        params: [agentId],
    })[0];
    const frontierIdx = Number(frontier?.max_idx ?? -1);

    agent.isStreaming = true;
    let errorText: string | null = null;
    let aborted = false;

    try {
        await ctx.fns.agent.run(ctx, { agent, userText: '', userMessageAlreadyAppended: true });
    } catch (e: any) {
        if (isAbortError(e)) {
            aborted = true;
        } else {
            errorText = e?.message ?? String(e);
            try { await ctx.fns.session.appendErrorEvent(ctx, { id: agentId, error: errorText ?? 'unknown error', ts: Date.now() }); } catch {}
        }
    } finally {
        const ts = Date.now();
        const advanceCursor = !aborted && !errorText;

        const after = ctx.fns.db.select<any>(ctx, {
            sql: "SELECT COALESCE(MAX(idx), -1) AS max_idx FROM messages WHERE agent_id = ? AND role = 'user' AND excluded_from_cursor = 0",
            params: [agentId],
        })[0];
        const afterIdx = Number(after?.max_idx ?? -1);

        // On abort/error keep the cursor untouched so the same messages get
        // retried on the next user-triggered pass — but don't auto-retry,
        // otherwise a permanently-broken LLM call burns the worker in a loop.
        const cursorIdx = advanceCursor
            ? frontierIdx
            : Number(ctx.fns.db.select<any>(ctx, {
                sql: 'SELECT last_processed_msg_idx FROM agents WHERE id = ?',
                params: [agentId],
            })[0]?.last_processed_msg_idx ?? -1);
        const stillPending = advanceCursor && afterIdx > cursorIdx;

        ctx.fns.db.exec(ctx, {
            sql: `UPDATE agents
                SET run_state = 'idle',
                    run_started_at = NULL,
                    last_processed_msg_idx = ?,
                    next_run_at = ?,
                    last_error = ?,
                    updated_at = ?
              WHERE id = ?`,
            params: [cursorIdx, stillPending ? ts + 5_000 : null, errorText, ts, agentId],
        });

        agent.abortController = null;
        agent.isStreaming = false;
        try { ctx.fns.session.syncAgentState(ctx, { agent }); } catch {}

        // If we just rescheduled (stillPending) or unblocked some other agent's
        // queue, kick the worker so the loop notices without waiting for a poll.
        try { ctx.fns.agent.wakeWorker?.(ctx); } catch {}
    }
}

export default async function (ctx: Context): Promise<void> {
    if ((ctx.state as any).workerLoopRunning) return;
    (ctx.state as any).workerLoopRunning = true;

    const inflight = new Set<Promise<unknown>>();

    while ((ctx.state as any).workerLoopRunning) {
        // Drain every claimable agent into a parallel promise. The atomic
        // claim guarantees no two concurrent runs target the same agent.
        // No artificial concurrency cap — backpressure comes from the LLM
        // provider (429 / connection errors) and SQLite serialising writes.
        let drained = 0;
        while (true) {
            const id = claimOne(ctx, Date.now());
            if (!id) break;
            drained++;
            const p = runOne(ctx, id).finally(() => inflight.delete(p));
            inflight.add(p);
        }

        if (inflight.size === 0) {
            // No work in flight. Sleep until either a wake signal lands or
            // the soonest scheduled `next_run_at` is due.
            const next = ctx.fns.db.select<any>(ctx, {
                sql: 'SELECT MIN(next_run_at) AS next FROM agents WHERE run_state = ? AND next_run_at IS NOT NULL AND archived_at IS NULL',
                params: ['idle'],
            })[0];
            const nextMs = next?.next ? Number(next.next) - Date.now() : MAX_IDLE_MS;
            const wait = Math.max(50, Math.min(MAX_IDLE_MS, nextMs));
            await waitForWork(ctx, wait);
        } else if (drained === 0) {
            // Runs are in flight but no new claims this cycle — wait for a
            // wake (a finishing run wakes via finally, a POST wakes via
            // wakeWorker). Avoids burning CPU in a tight while-loop.
            await waitForWork(ctx, MAX_IDLE_MS);
        }
        // else: drained > 0 — loop back immediately to look for more.
    }
}
