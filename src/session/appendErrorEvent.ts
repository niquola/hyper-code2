// Record an error in the transcript AND surface it to whoever has a tab open.
//
// An error that only lands in the event list is an error nobody sees until
// they scroll: a run can fail while the reader is on another page. The toast
// carries the full text as its body, so the detail is one glance away rather
// than one dig away.
/** Append error event for the runtime. */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Agent identifier. */
id: string;
        /** Error associated with the operation. */
error: string;
        /** Ts used by the operation. */
ts?: number }) {
    const appended = await ctx.fns.session.appendEventWithHtml({
        id: opts.id, type: "error", payload: { error: opts.error }, ts: opts.ts,
    });
    const text = String(opts.error ?? "");
    await ctx.fns.ui.notify({
        agentId: opts.id,
        level: "error",
        message: `${opts.id}: ${text.split("\n")[0]!.slice(0, 90)}`,
        body: text.length > 90 || text.includes("\n") ? text : undefined,
    }).catch(() => {});
    return appended;
}
