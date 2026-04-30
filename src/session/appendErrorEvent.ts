export default async function (ctx: Context, id: string, error: string, ts = Date.now()) {
    const event = { type: "error", error } as any;
    event.html = await ctx.fns.agent.renderEventHtml(ctx, event);
    return ctx.fns.session.appendEvent(ctx, id, event, ts);
}
