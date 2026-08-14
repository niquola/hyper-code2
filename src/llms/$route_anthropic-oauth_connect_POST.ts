export default async function (ctx: Context, _session: Session | null, _opts: { req: Request; params: Record<string, string> }) {
    const login = await ctx.fns.llm.startAnthropicOAuth({});
    // Keep the user on hyper-code2 so the manual fallback and status are always
    // available; the connections page opens the safe authorization URL.
    void login;
    return new Response(null, { status: 303, headers: { location: "/llms" } });
}
