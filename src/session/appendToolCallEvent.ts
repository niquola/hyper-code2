export default function (ctx: Context, id: string, payload: { name: string; args: any; result: string; argsHtml: string; resultHtml: string; isError: boolean }, ts = Date.now()) {
    return ctx.fns.session.appendEvent(ctx, id, { type: "tool_call", ...payload }, ts);
}
