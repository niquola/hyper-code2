// POST /settings/codex/logout — wipe ~/.codex/auth.json.
export default async function (ctx: Context, _session: Session | null, _opts: { req: Request; params: Record<string, string> }) {
    await ctx.fns.settings.logoutCodex({});
    return new Response(null, { status: 303, headers: { location: "/settings" } });
}
