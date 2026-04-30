export default async function (ctx: Context, id: string, payload: { name: string; args: any; result: string; argsHtml: string; resultHtml: string; isError: boolean }, ts = Date.now()) {
    const event = { type: "tool_call", ...payload } as any;
    event.html = await ctx.fns.agent.renderEventHtml(ctx, event);
    return ctx.fns.session.appendEvent(ctx, id, event, ts);
}
