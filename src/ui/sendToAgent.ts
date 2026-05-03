export default async function (ctx: Context, opts: { agentId: string; text: string; open?: boolean }) {
    const agent = (ctx.state as any).agent?.[opts.agentId];
    if (!agent) throw new Error('agent not found: ' + opts.agentId);
    const text = (opts.text ?? '').trim();
    if (!text) throw new Error('empty text');
    if (agent.isStreaming) throw new Error('agent busy');
    const offset = agent.events.length;
    agent.events.push({ type: 'user', text });
    if (opts.open) ctx.fns.events.emit(ctx, { event: { type: 'ui.navigate', path: '/agent/' + encodeURIComponent(agent.id) } });
    agent.isStreaming = true;
    queueMicrotask(async () => {
        try { await ctx.fns.agent.run(ctx, { agent, userText: text }); }
        catch (e: any) { agent.events.push({ type: 'error', error: e.message }); }
        finally { agent.isStreaming = false; }
    });
    return { agentId: agent.id, offset, nextOffset: agent.events.length, opened: !!opts.open };
}
