export default async function (ctx: Context, id: string, payload: { text: string; html: string; usage?: any; messageIdx?: number }, ts = Date.now()) {
    const event = { type: "assistant", ...payload } as any;
    event.eventHtml = await ctx.fns.agent.renderEventHtml(ctx, event, { agentId: id });
    return ctx.fns.session.appendEvent(ctx, id, event, ts);
}
