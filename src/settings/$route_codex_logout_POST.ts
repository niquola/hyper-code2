// POST /settings/codex/logout — wipe ~/.codex/auth.json.
export default async function (ctx: Context) {
    ctx.fns.settings.logoutCodex(ctx);
    return new Response(null, { status: 303, headers: { location: "/settings" } });
}
