export default async function (ctx: Context, opts: { id: string; payload: { text: string; html: string; usage?: any; messageIdx?: number }; ts?: number }) {
    return ctx.fns.session.appendEventWithHtml(ctx, { id: opts.id, type: "assistant", payload: opts.payload, ts: opts.ts });
}
