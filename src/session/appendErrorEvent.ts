export default async function (ctx: Context, _session: Session | null, opts: { id: string; error: string; ts?: number }) {
    return ctx.fns.session.appendEventWithHtml({ id: opts.id, type: "error", payload: { error: opts.error }, ts: opts.ts });
}
