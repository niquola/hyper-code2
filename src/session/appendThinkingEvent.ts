export default async function (ctx: Context, opts: { id: string; text: string; ts?: number }) {
    const { id, text } = opts;
    const ts = opts.ts ?? Date.now();
    const event = { type: "thinking", text } as any;
    event.html = await ctx.fns.agent.renderEventHtml(ctx, { event, agentId: id });
    return ctx.fns.session.appendEvent(ctx, { id, event, ts });
}
