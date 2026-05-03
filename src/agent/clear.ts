export default function (_ctx: Context, opts: { agent: types.agent.Agent }) {
    const { agent } = opts;
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
