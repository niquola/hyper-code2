export default function (ctx: Context, agent: types.agent.Agent) {
    try { agent.abortController?.abort(); } catch {}
    agent.abortController = null;
    agent.isStreaming = false;
    ctx.fns.session?.appendErrorEvent?.(ctx, agent.id, "stopped by user");
    ctx.fns.session?.syncAgentState?.(ctx, agent);
    return { ok: true };
}
