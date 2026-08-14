/** Performs the llm.completeAnthropicOAuth runtime operation. */
/**
 * Complete Anthropic OAuth using an authorization response.
 * @param opts.input Authorization response text or URL.
 * @param opts.code JavaScript source to evaluate in the browser.
 * @param opts.state OAuth state value.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Authorization response, callback URL, or code to parse. */ input?: string;
        /** JavaScript or TypeScript source to evaluate. */ code?: string;
        /** OAuth state value used to validate the callback. */ state?: string },
): Promise<{ ok: true }> {
    const store: any = (ctx.state as any).llm?.anthropicOAuth;
    const parsed = opts.input != null ? ctx.fns.llm.parseAnthropicAuthorizationInput({ input: opts.input }) : { code: opts.code ?? null, state: opts.state ?? null };
    let pending: any = null;
    const active = [...(store?.pending?.values?.() ?? [])].filter((p: any) => p.status === "pending" && p.expiresAt > Date.now());
    if (parsed.state) {
        pending = store?.pending?.get(parsed.state);
        if (!pending && active.length) throw new Error("Anthropic OAuth state mismatch");
    } else if (active.length === 1) pending = active[0];
    if (!pending || pending.expiresAt <= Date.now()) throw new Error("Anthropic OAuth login expired");
    if (parsed.state && parsed.state !== pending.state) throw new Error("Anthropic OAuth state mismatch");
    if (!parsed.code) throw new Error("Anthropic OAuth authorization code is missing");
    if (pending.status !== "pending") throw new Error("Anthropic OAuth callback was already used");
    pending.status = "exchanging";
    try {
        const token = await ctx.fns.llm.exchangeAnthropicOAuth({
            grant: "authorization_code", code: parsed.code, state: pending.state,
            verifier: pending.verifier, redirectUri: pending.redirectUri,
        });
        if (!token.refresh) throw new Error("Anthropic OAuth token exchange returned an invalid response");
        await ctx.fns.llm.saveAnthropicOAuth({ ...token, refresh: token.refresh });
        pending.status = "complete";
        pending.verifier = null;
        store.lastError = null;
        store.pending.delete(pending.state);
        try { pending.server?.close(); } catch {}
        return { ok: true };
    } catch (e: any) {
        pending.status = "failed";
        pending.verifier = null;
        store.lastError = safeError(e);
        store.pending.delete(pending.state);
        try { pending.server?.close(); } catch {}
        throw new Error(store.lastError);
    }
}

function safeError(e: any): string {
    const s = String(e?.message ?? e);
    return s.startsWith("Anthropic OAuth ") ? s : "Anthropic OAuth login failed";
}
