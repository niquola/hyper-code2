/** Handles the HTTP route anthropic-oauth logout POST endpoint. */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */ req: Request;
        /** Route parameters captured from the request path. */ params: Record<string, string> }) {
    // Disconnecting one Claude login must not sign the other one out.
    let account = "default";
    let all = false;
    try {
        const form = await opts.req.formData();
        account = String(form.get("account") ?? "").trim() || "default";
        all = String(form.get("all") ?? "") === "1";
    } catch { /* no body: legacy single-account button */ }
    await ctx.fns.llm.logoutAnthropicOAuth({ account, all });
    return new Response(null, { status: 303, headers: { location: "/llms" } });
}
