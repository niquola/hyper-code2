export default async function (ctx: Context, _session: Session | null, opts: { agentId: string }) {
    const agentId = opts.agentId;
    const agent = (ctx.state as any).agent?.[agentId];
    if (!agent) throw new Error('agent not found: ' + agentId);
    ctx.fns.procs.events.emit({ event: { type: 'ui.navigate', path: '/agent/' + encodeURIComponent(agentId) } });
    return { opened: agentId };
}
