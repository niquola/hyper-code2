// POST /settings/kimi/logout — wipe ~/.kimi/credentials/kimi-code.json.
export default async function (ctx: Context) {
    ctx.fns.settings.logoutKimi(ctx);
    return new Response(null, { status: 303, headers: { location: "/settings" } });
}
