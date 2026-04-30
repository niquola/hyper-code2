export default async function (ctx: Context, agentId: string) {
    const agent = (ctx.state as any).agent?.[agentId];
    if (!agent) throw new Error('agent not found: ' + agentId);
    ctx.fns.events.emit(ctx, { type: 'ui.navigate', path: '/agent/' + encodeURIComponent(agentId) });
    return { opened: agentId };
}
