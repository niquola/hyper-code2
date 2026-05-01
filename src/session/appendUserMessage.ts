export default async function (ctx: Context, id: string, text: string, ts = Date.now()) {
    const out = ctx.fns.session.appendMessage(ctx, id, { role: "user", content: text }, ts);
    const event = { type: "user", text, messageIdx: out.idx } as any;
    event.html = await ctx.fns.agent.renderEventHtml(ctx, event, { agentId: id });
    ctx.fns.session.appendEvent(ctx, id, event, ts);
    return out;
}
