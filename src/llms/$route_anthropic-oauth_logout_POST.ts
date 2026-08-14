export default async function (ctx: Context, _session: Session | null, _opts: { req: Request; params: Record<string, string> }) {
    await ctx.fns.llm.logoutAnthropicOAuth({});
    return new Response(null, { status: 303, headers: { location: "/llms" } });
}
