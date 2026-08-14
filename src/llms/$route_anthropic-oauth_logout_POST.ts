/** Handles the HTTP route anthropic-oauth logout POST endpoint. */
export default async function (ctx: Context, _session: Session | null, _opts: {
        /** Incoming HTTP request. */ req: Request;
        /** Route parameters captured from the request path. */ params: Record<string, string> }) {
    await ctx.fns.llm.logoutAnthropicOAuth({});
    return new Response(null, { status: 303, headers: { location: "/llms" } });
}
