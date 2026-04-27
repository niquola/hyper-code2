// POST /settings/kimi/login — start the device-authorization flow.
// The page redirects back to /settings, which renders the user_code + URL
// from ctx.state.settings.kimi (populated by startKimiLogin).
export default async function (ctx: Context) {
    await ctx.fns.settings.startKimiLogin(ctx);
    return new Response(null, { status: 303, headers: { location: "/settings" } });
}
