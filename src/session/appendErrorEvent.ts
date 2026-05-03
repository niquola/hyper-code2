export default async function (ctx: Context, opts: { id: string; error: string; ts?: number }) {
    const { id, error } = opts;
    const ts = opts.ts ?? Date.now();
    const event = { type: "error", error } as any;
    event.html = await ctx.fns.agent.renderEventHtml(ctx, { event, agentId: id });
    return ctx.fns.session.appendEvent(ctx, { id, event, ts });
}
