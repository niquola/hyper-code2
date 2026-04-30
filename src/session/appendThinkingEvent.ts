export default async function (ctx: Context, id: string, text: string, ts = Date.now()) {
    const event = { type: "thinking", text } as any;
    event.html = await ctx.fns.agent.renderEventHtml(ctx, event);
    return ctx.fns.session.appendEvent(ctx, id, event, ts);
}
