// POST /settings/codex/login — start codex device-auth flow.
/** Handles the HTTP route codex login POST endpoint. */
export default async function (ctx: Context, _session: Session | null, _opts: {
        /** Incoming HTTP request. */ req: Request;
        /** Route parameters captured from the request path. */ params: Record<string, string> }) {
    try { await ctx.fns.settings.startCodexLogin({}); }
    catch (e: any) {
        const s = (ctx.state as any).settings ?? ((ctx.state as any).settings = {});
        s.codex = { status: "failed", error: e?.message ?? String(e) };
    }
    return new Response(null, { status: 303, headers: { location: "/settings" } });
}
