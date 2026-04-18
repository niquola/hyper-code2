export default function (ctx: Context, agent: types.agent.Agent) {
    try { agent.abortController?.abort(); } catch {}
    agent.abortController = null;
    agent.isStreaming = false;
    agent.events.push({ type: "error", error: "stopped by user" });
    return { ok: true };
}
