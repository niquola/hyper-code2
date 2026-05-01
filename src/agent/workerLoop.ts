// One worker per process drains agent_jobs serially.
// Atomic claim via SQL: UPDATE ... WHERE status='queued' AND debounce_until <= now.
// When idle, sleeps until either wakeWorker fires or the soonest debounce_until elapses (capped 30s).
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

        // Atomic claim: pick the earliest queued job whose debounce has elapsed.
        const runKey = 'run_' + crypto.randomUUID().slice(0, 8);
        const claimed = ctx.fns.db.exec(ctx,
            `UPDATE agent_jobs
             SET status = ?, run_key = ?, started_at = ?, finished_at = NULL, updated_at = ?
             WHERE id = (
               SELECT id FROM agent_jobs
               WHERE status = ? AND debounce_until <= ?
               ORDER BY debounce_until ASC, created_at ASC
               LIMIT 1
             )`,
            ['running', runKey, now, now, 'queued', now],
        );

        if (!Number(claimed?.changes ?? 0)) {
            // Nothing claimable. Sleep until next debounce_until or until worker is woken.
            const next = ctx.fns.db.select<any>(ctx,
                'SELECT MIN(debounce_until) AS next FROM agent_jobs WHERE status = ?',
                ['queued'],
            )[0];
            const nextMs = next?.next ? Number(next.next) - Date.now() : MAX_IDLE_MS;
            const wait = Math.max(50, Math.min(MAX_IDLE_MS, nextMs));
            await waitForWork(ctx, wait);
            continue;
        }

        const job = ctx.fns.db.select<any>(ctx,
            'SELECT id, agent_id, payload_json FROM agent_jobs WHERE run_key = ? LIMIT 1',
            [runKey],
        )[0];
        if (!job) continue;

        const agent = loadAgent(ctx, job.agent_id);
        if (!agent) {
            // Orphaned job — mark failed and keep going.
            const ts = Date.now();
            ctx.fns.db.exec(ctx,
                'UPDATE agent_jobs SET status = ?, error = ?, finished_at = ?, updated_at = ? WHERE id = ?',
                ['failed', 'agent not found', ts, ts, job.id],
            );
            continue;
        }

        const payload = JSON.parse(job.payload_json || '{}');
        agent.currentJobId = job.id;
        agent.isStreaming = true;

        let finalStatus = 'done';
        let abortReason: string | null = null;
        let errorText: string | null = null;

        try {
            await ctx.fns.agent.run(ctx, agent, String(payload.text ?? ''), {
                userMessageAlreadyAppended: true,
            });
        } catch (e: any) {
            if (isAbortError(e)) {
                finalStatus = 'aborted';
                abortReason = 'aborted';
            } else {
                finalStatus = 'failed';
                errorText = e?.message ?? String(e);
                try {
                    await ctx.fns.session.appendErrorEvent(ctx, agent.id, errorText ?? 'unknown error', Date.now());
                    ctx.fns.session.syncAgentState(ctx, agent);
                } catch { /* swallow */ }
            }
        } finally {
            const ts = Date.now();
            ctx.fns.db.exec(ctx,
                'UPDATE agent_jobs SET status = ?, abort_reason = COALESCE(abort_reason, ?), error = ?, finished_at = ?, updated_at = ? WHERE id = ?',
                [finalStatus, abortReason, errorText, ts, ts, job.id],
            );
            agent.currentJobId = null;
            agent.abortController = null;
            agent.isStreaming = false;
            try { ctx.fns.session.syncAgentState(ctx, agent); } catch {}
        }
    }
}
