export default function (ctx: Context, id: string, text: string, ts = Date.now()) {
    return ctx.fns.session.appendMessage(ctx, id, { role: "user", content: text }, ts);
}
