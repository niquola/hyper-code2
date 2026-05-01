export default function (ctx: Context, agent: types.agent.Agent, opts: { clearQueue?: boolean } = {}) {
    const clearQueue = opts.clearQueue === true;
    const now = Date.now();

    if (agent.currentJobId) {
        ctx.fns.db.exec(ctx, 'UPDATE agent_jobs SET status = ?, abort_reason = ?, finished_at = COALESCE(finished_at, ?) WHERE id = ? AND status IN (?, ?, ?)', [
            'aborted',
            'stopped_by_user',
            now,
            agent.currentJobId,
            'queued',
            'running',
            'cancelling',
        ]);
    }

    if (clearQueue) {
        ctx.fns.db.exec(ctx, 'UPDATE agent_jobs SET status = ?, abort_reason = ?, finished_at = COALESCE(finished_at, ?) WHERE agent_id = ? AND status = ?', [
            'aborted',
            'queue_cleared_by_user',
            now,
            agent.id,
            'queued',
        ]);
    }

    try { agent.abortController?.abort('stopped_by_user'); } catch {}
    agent.abortController = null;
    agent.isStreaming = false;
    ctx.fns.session?.appendErrorEvent?.(ctx, agent.id, clearQueue ? 'stopped by user; queue cleared' : 'stopped by user');
    ctx.fns.session?.syncAgentState?.(ctx, agent);
    return { ok: true, clearQueue };
}
