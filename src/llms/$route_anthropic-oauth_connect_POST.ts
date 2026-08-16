/** Handles the HTTP route anthropic-oauth connect POST endpoint. */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */ req: Request;
        /** Route parameters captured from the request path. */ params: Record<string, string> }) {
    // A named slot is what makes this "add another Claude account" instead of
    // "replace the one I have". Empty means the default (first) account.
    let account = "default";
    let label: string | null = null;
    try {
        const form = await opts.req.formData();
        account = String(form.get("account") ?? "").trim().replace(/[^\w\-.]/g, "").slice(0, 40) || "default";
        label = String(form.get("label") ?? "").trim().slice(0, 80) || null;
    } catch { /* no body: the plain Connect button */ }
    const login = await ctx.fns.llm.startAnthropicOAuth({ account, label });
    // Keep the user on hyper-code2 so the manual fallback and status are always
    // available; the connections page opens the safe authorization URL.
    void login;
    return new Response(null, { status: 303, headers: { location: "/llms" } });
}
