export default function (ctx: Context, id: string, error: string, ts = Date.now()) {
    return ctx.fns.session.appendEvent(ctx, id, { type: "error", error }, ts);
}
