export default async function (ctx: Context, _session: Session | null, opts: { id: string; text: string; ts?: number }) {
    return ctx.fns.session.appendEventWithHtml({ id: opts.id, type: "thinking", payload: { text: opts.text }, ts: opts.ts });
}
