export default async function (ctx: Context, opts: { id: string; error: string; ts?: number }) {
    return ctx.fns.session.appendEventWithHtml(ctx, { id: opts.id, type: "error", payload: { error: opts.error }, ts: opts.ts });
}
