/** Completes the manual fallback of a managed Claude OAuth popup. */
/**
 * Complete managed Claude OAuth from a redirect URL or one-time code.
 *
 * The submitted value is consumed immediately by llm.completeAnthropicOAuth and
 * is never stored, logged, included in events, or echoed in the response.
 *
 * @param opts.authorization Final callback URL or one-time authorization code.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** OAuth redirect URL or one-time code. */ authorization: string;
}): Promise<string> {
    await ctx.fns.llm.completeAnthropicOAuth({ input: String(opts.authorization ?? "") });
    ctx.fns.procs.events.refresh({ topic: "llm-accounts", reason: "Claude OAuth connected" });
    return ctx.fns.ui.popupContent({
        title: "Claude account connected",
        kind: "success",
        html: `<div class="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success"><i class="ph ph-check-circle mr-1"></i>Claude account connected. You can close this popup; the account list will refresh.</div>`,
    });
}
