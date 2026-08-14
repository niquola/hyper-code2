/** Clear for the runtime.  * @param opts.agent Agent whose state is read or updated.
*/
export default function (_ctx: Context, _session: Session | null, opts: {
        /** Live agent instance to operate on. */
agent: types.agent.Agent }) {
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
