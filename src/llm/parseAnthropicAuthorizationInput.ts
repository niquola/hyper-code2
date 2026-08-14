/** Performs the llm.parseAnthropicAuthorizationInput runtime operation. */
/**
 * Parse an Anthropic OAuth authorization response.
 * @param opts.input Authorization response text or URL.
 */
export default function (_ctx: Context, _session: Session | null, opts: {
        /** Authorization response, callback URL, or code to parse. */ input: string }): { code: string | null; state: string | null } {
    const value = String(opts.input ?? "").trim();
    if (!value) return { code: null, state: null };
    try {
        const u = new URL(value);
        return { code: u.searchParams.get("code"), state: u.searchParams.get("state") };
    } catch { /* not a URL */ }
    if (value.includes("#")) {
        const [code, state] = value.split("#", 2);
        return { code: code || null, state: state || null };
    }
    if (value.includes("code=")) {
        const p = new URLSearchParams(value);
        return { code: p.get("code"), state: p.get("state") };
    }
    return { code: value, state: null };
}
