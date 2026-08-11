// In-process worker. Drains agents whose debounce window has elapsed.
// Multiple agents run concurrently — each one is its own promise; the loop
// claims as much work as is currently pending, then sleeps for new wakes.
//
// Per-agent serialisation is enforced by the atomic claim itself:
//
//   UPDATE agents SET run_state='running' WHERE id IN (SELECT … LIMIT 1) RETURNING id
//
// Two concurrent claims targeting the same `idle` row can't both win — Postgres
// row locking on UPDATE…RETURNING ensures exactly one statement gets the id. So we never
// need an in-memory `inflight` Map keyed by agent id; the DB is the lock.
//
// State on the agents row:
//   next_run_at + run_state + last_processed_msg_idx (cursor over USER msgs)
const MAX_IDLE_MS = 30_000;

function isAbortError(error: any) {
    const msg = String(error?.message ?? error ?? '');
    return msg.includes('aborted') || msg.includes('AbortError');
}

async function loadAgent(ctx: Context, id: string): Promise<any> {
    let a = (ctx.state as any).agent?.[id];
    if (a) return a;
    a = (await ctx.fns.session?.load?.({ id })) ?? null;
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

// Free runs whose claim is older than the lease — a wedged stream / crashed
// promise must not hold an agent hostage forever. Recovered agents surface as
// an error (statusbar badge); the next message retries them.
const RUN_LEASE_MS = 10 * 60_000;
async function recoverStaleRuns(ctx: Context, now: number): Promise<void> {
    await ctx.fns.procs.db.run({
        sql: `UPDATE agents
            SET run_state = 'idle', run_started_at = NULL,
                last_error = 'stale run recovered (exceeded ' || ? || 's lease)', updated_at = ?
          WHERE run_state = 'running' AND run_started_at IS NOT NULL AND run_started_at < ?`,
        params: [Math.round(RUN_LEASE_MS / 1000), now, now - RUN_LEASE_MS],
    });
}

// Atomically claim ONE pending agent, returning its id (or null if none).
async function claimOne(ctx: Context, now: number): Promise<string | null> {
    const claimed = await ctx.fns.procs.db.select({
        sql: `UPDATE agents
            SET run_state      = 'running',
                run_started_at = ?,
                next_run_at    = NULL,
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
    }) as any[];
    return claimed.length === 0 ? null : (claimed[0]!.id as string);
}

// Run one agent end-to-end. Mirrors what the old single-agent loop body did:
// frontier snapshot → run() → finally: advance cursor / reschedule / mark idle.
async function runOne(ctx: Context, agentId: string): Promise<void> {
    const agent = await loadAgent(ctx, agentId);
    if (!agent) {
        const ts = Date.now();
        await ctx.fns.procs.db.run({
            sql: `UPDATE agents SET run_state = 'idle', last_error = ?, updated_at = ? WHERE id = ?`,
            params: ['agent not found at run-time', ts, agentId],
        });
        return;
    }

    // Snapshot USER-message frontier before run(). Cursor only advances on success,
    // and "did new messages arrive during the run" must mean new real user
    // messages — synthetic §result:* / §error:* user-rows are
    // excluded_from_cursor=1, assistant emissions are not 'user' role.
    const frontier = ((await ctx.fns.procs.db.select({
        sql: "SELECT COALESCE(MAX(idx), -1) AS max_idx FROM messages WHERE agent_id = ? AND role = 'user' AND excluded_from_cursor = 0",
        params: [agentId],
    })) as any[])[0];
    const frontierIdx = Number(frontier?.max_idx ?? -1);

    agent.isStreaming = true;
    let errorText: string | null = null;
    let aborted = false;

    // Steering: run() reports the user-message frontier its LAST model call
    // actually saw — everything up to it was answered inside this run, so the
    // cursor advances to it and no duplicate pass is scheduled for it.
    let consumedIdx = frontierIdx;
    try {
        const result = await ctx.fns.agent.run({ agent, userText: '', userMessageAlreadyAppended: true });
        consumedIdx = Math.max(frontierIdx, Number((result as any)?.consumedUserIdx ?? -1));
    } catch (e: any) {
        if (isAbortError(e)) {
            aborted = true;
        } else {
            errorText = e?.message ?? String(e);
            try { await ctx.fns.session.appendErrorEvent({ id: agentId, error: errorText ?? 'unknown error', ts: Date.now() }); } catch {}
        }
    } finally {
        const ts = Date.now();
        const advanceCursor = !aborted && !errorText;

        // ONE atomic finalize — the read-compute-write it replaces had a race:
        // a POST landing between "read afterIdx" and "UPDATE … next_run_at=NULL"
        // had its fresh schedule wiped, and the message never ran. Claiming
        // consumes next_run_at (claimOne sets it NULL), so any value present
        // here was set by a concurrent POST and must survive; pending work with
        // no schedule gets one. Cursor advances only on success; on abort/error
        // it stays put so the same messages retry on the next user-triggered
        // pass (no auto-retry — a permanently-broken LLM call would burn the
        // worker in a loop).
        const finalized = await ctx.fns.procs.db.run({
            sql: `UPDATE agents
                SET run_state = 'idle',
                    run_started_at = NULL,
                    last_processed_msg_idx = CASE WHEN ? = 1 THEN ? ELSE last_processed_msg_idx END,
                    next_run_at = CASE
                        WHEN ? = 1 THEN
                            -- success: reschedule iff a user message exists past what
                            -- this run's LAST model call consumed (steering answered
                            -- everything up to consumedIdx inside the run); a schedule
                            -- for an already-consumed POST is cleared. A message that
                            -- commits after this snapshot re-sets next_run_at itself,
                            -- serialized after this row lock — nothing is lost.
                            CASE WHEN (SELECT COALESCE(MAX(idx), -1) FROM messages m
                                        WHERE m.agent_id = agents.id AND m.role = 'user' AND m.excluded_from_cursor = 0) > ?
                                 THEN COALESCE(next_run_at, ?)
                                 ELSE NULL END
                        -- abort/error: keep whatever schedule a concurrent POST set
                        -- (user-triggered retry); claim consumed the original one.
                        ELSE next_run_at
                    END,
                    last_error = ?,
                    updated_at = ?
              WHERE id = ?
              RETURNING next_run_at`,
            params: [advanceCursor ? 1 : 0, consumedIdx, advanceCursor ? 1 : 0, consumedIdx, ts + 100, errorText, ts, agentId],
        });

        // One automatic retry for TRANSIENT failures (stalled stream, 429/5xx,
        // dropped connection): reschedule once with a short backoff. Anything
        // else — and a second failure in a row — stays manual (statusbar badge).
        const transient = errorText && /stalled|429|(?:^|\D)5\d\d(?:\D|$)|Connection closed|ConnectionRefused|network|ETIMEDOUT|ECONNRESET|timed? ?out/i.test(errorText);
        const retries: Record<string, number> = ((ctx.state as any).agentRunRetries ??= {});
        if (!errorText) delete retries[agentId];
        else if (transient && (retries[agentId] ?? 0) < 1) {
            retries[agentId] = (retries[agentId] ?? 0) + 1;
            await ctx.fns.procs.db.run({
                sql: 'UPDATE agents SET next_run_at = COALESCE(next_run_at, ?) WHERE id = ?',
                params: [ts + 10_000, agentId],
            });
        }

        agent.abortController = null;
        agent.isStreaming = false;
        try { await ctx.fns.session.syncAgentState({ agent }); } catch {}

        // If the agent left finalize with a schedule (pending work or a
        // concurrent POST), kick the worker so the loop notices immediately.
        const rescheduled = (finalized.rows[0] as any)?.next_run_at != null;
        if (rescheduled) { try { ctx.fns.agent.wakeWorker?.({}); } catch {} }
    }
}

export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<void> {
    if ((ctx.state as any).workerLoopRunning) return;
    (ctx.state as any).workerLoopRunning = true;

    const inflight = new Set<Promise<unknown>>();

    while ((ctx.state as any).workerLoopRunning) {
        // Drain every claimable agent into a parallel promise. The atomic
        // claim guarantees no two concurrent runs target the same agent.
        // No artificial concurrency cap — backpressure comes from the LLM
        // provider (429 / connection errors) and Postgres serialising row writes.
        let drained = 0;
        await recoverStaleRuns(ctx, Date.now()).catch(() => undefined);
        while (true) {
            const id = await claimOne(ctx, Date.now());
            if (!id) break;
            drained++;
            const p = runOne(ctx, id).finally(() => {
                inflight.delete(p);
                // A completion changes claimability (the agent becomes idle and
                // may leave pending work). Wake the parked loop immediately;
                // otherwise another agent can sit scheduled for MAX_IDLE_MS.
                try { ctx.fns.agent.wakeWorker({}); } catch {}
            });
            inflight.add(p);
        }

        if (inflight.size === 0) {
            // No work in flight. Sleep until either a wake signal lands or
            // the soonest scheduled `next_run_at` is due.
            const next = ((await ctx.fns.procs.db.select({
                sql: 'SELECT MIN(next_run_at) AS next FROM agents WHERE run_state = ? AND next_run_at IS NOT NULL AND archived_at IS NULL',
                params: ['idle'],
            })) as any[])[0];
            const nextMs = next?.next ? Number(next.next) - Date.now() : MAX_IDLE_MS;
            const wait = Math.max(50, Math.min(MAX_IDLE_MS, nextMs));
            await waitForWork(ctx, wait);
        } else if (drained === 0) {
            // Runs are in flight but no new claims this cycle. A different idle
            // agent may already be scheduled a few milliseconds ahead, so wait
            // for the earlier of a wake and the next due time — never a blind
            // MAX_IDLE_MS sleep that accidentally serialises agents.
            const next = ((await ctx.fns.procs.db.select({
                sql: 'SELECT MIN(next_run_at) AS next FROM agents WHERE run_state = ? AND next_run_at IS NOT NULL AND archived_at IS NULL',
                params: ['idle'],
            })) as any[])[0];
            const nextMs = next?.next ? Number(next.next) - Date.now() : MAX_IDLE_MS;
            await waitForWork(ctx, Math.max(50, Math.min(MAX_IDLE_MS, nextMs)));
        }
        // else: drained > 0 — loop back immediately to look for more.
    }

    // Graceful shutdown: don't return while runOne finalizers still have
    // in-flight DB writes — callers (and test afterAll pool close) rely on
    // the loop promise resolving only after all claimed work has settled.
    if (inflight.size > 0) await Promise.allSettled([...inflight]);
}
