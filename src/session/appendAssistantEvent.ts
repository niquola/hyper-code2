export default async function (ctx: Context, _session: Session | null, opts: { id: string; payload: { text: string; html: string; usage?: any; messageIdx?: number; instructionIndicators?: { statusLine?: string | null; reflectionNudge?: string | null } }; ts?: number }) {
    return ctx.fns.session.appendEventWithHtml({ id: opts.id, type: "assistant", payload: opts.payload, ts: opts.ts });
}
