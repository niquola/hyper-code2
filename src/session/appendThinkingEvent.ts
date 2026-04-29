export default function (ctx: Context, id: string, text: string, ts = Date.now()) {
    return ctx.fns.session.appendEvent(ctx, id, { type: "thinking", text }, ts);
}
