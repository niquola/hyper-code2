// Single in-process worker. Drains agents whose debounce window has elapsed.
// State lives on the agents row: next_run_at + run_state + last_processed_msg_idx.
// One run can cover multiple new user messages — they merge naturally.
const MAX_IDLE_MS = 30_000;

function isAbortError(error: any) {
    const msg = String(error?.message ?? error ?? '');
    return msg.includes('aborted') || msg.includes('AbortError');
}

function loadAgent(ctx: Context, id: string): any {
    let a = (ctx.state as any).agent?.[id];
    if (a) return a;
    a = ctx.fns.session?.load?.(ctx, id) ?? null;
    if (a) {
        (ctx.state as any).agent ??= {};
        (ctx.state as any).agent[id] = a;
    }
    return a;
}

function waitForWork(ctx: Context, timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
        const set: Set<() => void> = ((ctx.state as any).workerWakeWaiters ??= new Set());
        let done = false;
        const onWake = () => { if (done) return; done = true; clearTimeout(t); set.delete(onWake); resolve(); };
        const t = setTimeout(() => { if (done) return; done = true; set.delete(onWake); resolve(); }, Math.max(0, timeoutMs));
        set.add(onWake);
    });
}

export default async function (ctx: Context): Promise<void> {
    if ((ctx.state as any).workerLoopRunning) return;
    (ctx.state as any).workerLoopRunning = true;

    while ((ctx.state as any).workerLoopRunning) {
        const now = Date.now();

        // Atomic claim: pick one idle agent whose debounce window is open.
        const claimed = ctx.fns.db.select<any>(ctx,
            `UPDATE agents
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
            [now, now, now],
        );

        if (claimed.length === 0) {
            const next = ctx.fns.db.select<any>(ctx,
                'SELECT MIN(next_run_at) AS next FROM agents WHERE run_state = ? AND next_run_at IS NOT NULL AND archived_at IS NULL',
                ['idle'],
            )[0];
            const nextMs = next?.next ? Number(next.next) - Date.now() : MAX_IDLE_MS;
            const wait = Math.max(50, Math.min(MAX_IDLE_MS, nextMs));
            await waitForWork(ctx, wait);
            continue;
        }

        const agentId = claimed[0]!.id;
        const agent = loadAgent(ctx, agentId);
        if (!agent) {
            const ts = Date.now();
            ctx.fns.db.exec(ctx,
                `UPDATE agents SET run_state = 'idle', last_error = ?, updated_at = ? WHERE id = ?`,
                ['agent not found at run-time', ts, agentId],
            );
            continue;
        }

        // Snapshot the message frontier before run() — so we know which messages were "in this batch"
        // even if run() (or concurrent POSTs) appends more during execution.
        const frontier = ctx.fns.db.select<any>(ctx,
            'SELECT COALESCE(MAX(idx), -1) AS max_idx FROM messages WHERE agent_id = ?',
            [agentId],
        )[0];
        const frontierIdx = Number(frontier?.max_idx ?? -1);

        agent.isStreaming = true;
        let errorText: string | null = null;
        let aborted = false;

        try {
            await ctx.fns.agent.run(ctx, agent, '', { userMessageAlreadyAppended: true });
        } catch (e: any) {
            if (isAbortError(e)) {
                aborted = true;
            } else {
                errorText = e?.message ?? String(e);
                try { await ctx.fns.session.appendErrorEvent(ctx, agentId, errorText ?? 'unknown error', Date.now()); } catch {}
            }
        } finally {
            const ts = Date.now();
            // Advance cursor only on success (not on abort/error) so retried runs see the same frontier.
            const advanceCursor = !aborted && !errorText;

            // If new messages arrived during the run, schedule another pass with the same debounce
            // (so consecutive replies merge naturally). Otherwise clear next_run_at.
            const after = ctx.fns.db.select<any>(ctx,
                'SELECT COALESCE(MAX(idx), -1) AS max_idx FROM messages WHERE agent_id = ?',
                [agentId],
            )[0];
            const afterIdx = Number(after?.max_idx ?? -1);

            // Advance cursor only on success. On abort/error keep the cursor where it was
            // so the same messages get retried on the next pass — but only when the user
            // explicitly schedules another run (POST). We do NOT auto-reschedule a failing
            // run, otherwise a permanently-broken LLM call would burn the worker in a loop.
            const cursorIdx = advanceCursor
                ? frontierIdx
                : Number(ctx.fns.db.select<any>(ctx,
                    'SELECT last_processed_msg_idx FROM agents WHERE id = ?',
                    [agentId])[0]?.last_processed_msg_idx ?? -1);
            const stillPending = advanceCursor && afterIdx > cursorIdx;

            ctx.fns.db.exec(ctx,
                `UPDATE agents
                    SET run_state = 'idle',
                        run_started_at = NULL,
                        last_processed_msg_idx = ?,
                        next_run_at = ?,
                        last_error = ?,
                        updated_at = ?
                  WHERE id = ?`,
                [
                    cursorIdx,
                    stillPending ? ts + 5_000 : null,
                    errorText,
                    ts,
                    agentId,
                ],
            );

            agent.abortController = null;
            agent.isStreaming = false;
            try { ctx.fns.session.syncAgentState(ctx, agent); } catch {}
        }
    }
}
