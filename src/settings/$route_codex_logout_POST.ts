// POST /settings/codex/logout — wipe ~/.codex/auth.json.
/** Handles the HTTP route codex logout POST endpoint. */
export default async function (ctx: Context, _session: Session | null, _opts: {
        /** Incoming HTTP request. */ req: Request;
        /** Route parameters captured from the request path. */ params: Record<string, string> }) {
    await ctx.fns.settings.logoutCodex({});
    return new Response(null, { status: 303, headers: { location: "/settings" } });
}
