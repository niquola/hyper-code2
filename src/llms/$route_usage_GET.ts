/** Handles the llms usage GET HTTP route — the live subscription quota rings. */
export default async function (ctx: Context, _session: Session | null, _opts: {
    /** Incoming HTTP request. */
    req?: Request;
}) {
    // Keep externally reported subscription windows fresh even when no model
    // turn has completed recently. Provider failures stay isolated per account.
    await ctx.fns.llm.refreshUsage({ maxAgeMs: 60_000 }).catch(() => undefined);

    const entries = await ctx.fns.llm.usageOverview({});
    // A live region rather than a poll: recordUsage runs on every LLM response,
    // so the watchdog interval only repairs a missed signal.
    const html = ctx.fns.ui.live({
        id: "llm-usage",
        url: "/llms/usage",
        topic: "llm-usage",
        every: 60,
        attrs: 'class="block"',
        html: ctx.fns.ui.usageDial({ entries }),
    });
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
