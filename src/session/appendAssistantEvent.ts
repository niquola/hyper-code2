export default function (ctx: Context, id: string, payload: { text: string; html: string; usage?: any }, ts = Date.now()) {
    return ctx.fns.session.appendEvent(ctx, id, { type: "assistant", ...payload }, ts);
}
