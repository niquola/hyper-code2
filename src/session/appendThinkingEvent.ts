/** Append thinking event for the runtime. */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Agent identifier. */
id: string;
        /** Text used by the operation. */
text: string;
        /** Ts used by the operation. */
ts?: number }) {
    return ctx.fns.session.appendEventWithHtml({ id: opts.id, type: "thinking", payload: { text: opts.text }, ts: opts.ts });
}
