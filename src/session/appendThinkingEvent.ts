export default async function (ctx: Context, opts: { id: string; text: string; ts?: number }) {
    return ctx.fns.session.appendEventWithHtml(ctx, { id: opts.id, type: "thinking", payload: { text: opts.text }, ts: opts.ts });
}
