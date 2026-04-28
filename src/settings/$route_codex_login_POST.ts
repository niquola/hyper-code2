// POST /settings/codex/login — start codex device-auth flow.
export default async function (ctx: Context) {
    try { await ctx.fns.settings.startCodexLogin(ctx); }
    catch (e: any) {
        const s = (ctx.state as any).settings ?? ((ctx.state as any).settings = {});
        s.codex = { status: "failed", error: e?.message ?? String(e) };
    }
    return new Response(null, { status: 303, headers: { location: "/settings" } });
}
