/** Performs the ui.sendToAgent runtime operation. */
/**
 * Send text to an agent from the browser UI.
 * @param opts.agentId Target agent identifier.
 * @param opts.text Text to send.
 * @param opts.open Whether to open the target agent after the operation.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Identifier of the agent whose scoped setting is used. */ agentId: string;
        /** Text to send to the agent. */ text: string;
        /** Whether to open the agent after sending. */ open?: boolean }) {
    const agent = (ctx.state as any).agent?.[opts.agentId];
    if (!agent) throw new Error('agent not found: ' + opts.agentId);
    const text = (opts.text ?? '').trim();
    if (!text) throw new Error('empty text');
    if (agent.isStreaming) throw new Error('agent busy');
    const offset = agent.events.length;
    agent.events.push({ type: 'user', text });
    if (opts.open) ctx.fns.procs.events.emit({ event: { type: 'ui.navigate', path: '/agent/' + encodeURIComponent(agent.id) } });
    agent.isStreaming = true;
    queueMicrotask(async () => {
        try { await ctx.fns.agent.run({ agent, userText: text }); }
        catch (e: any) { agent.events.push({ type: 'error', error: e.message }); }
        finally { agent.isStreaming = false; }
    });
    return { agentId: agent.id, offset, nextOffset: agent.events.length, opened: !!opts.open };
}
