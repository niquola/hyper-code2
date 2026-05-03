export default function (ctx: Context, opts: { agent: types.agent.Agent; clearQueue?: boolean }) {
    const { agent } = opts;
    const clearQueue = opts.clearQueue === true;
    const now = Date.now();

    // Abort the in-flight LLM call if any.
    try { agent.abortController?.abort('stopped_by_user'); } catch {}

    // Reset run state on the agent row. clearQueue also drops the pending debounce window.
    ctx.fns.db.exec(ctx, {
        sql: `UPDATE agents
            SET run_state = 'idle',
                run_started_at = NULL,
                next_run_at = ${clearQueue ? 'NULL' : 'next_run_at'},
                last_error = ?,
                updated_at = ?
          WHERE id = ?`,
        params: [clearQueue ? 'stopped by user; queue cleared' : 'stopped by user', now, agent.id],
    });

    agent.abortController = null;
    agent.isStreaming = false;
    ctx.fns.session?.appendErrorEvent?.(ctx, { id: agent.id, error: clearQueue ? 'stopped by user; queue cleared' : 'stopped by user' });
    ctx.fns.session?.syncAgentState?.(ctx, { agent });
    return { ok: true, clearQueue };
}
