export default function (ctx: Context, agent: types.agent.Agent) {
    try { agent.abortController?.abort(); } catch {}
    agent.abortController = null;
    agent.messages = [];
    agent.events = [];
    agent.cursors = {};
    agent.subscribers.clear();
    agent.waiters = [];
    agent.isStreaming = false;
    return { ok: true };
}
