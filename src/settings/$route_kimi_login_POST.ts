// POST /settings/kimi/login — start the device-authorization flow.
// The page redirects back to /settings, which renders the user_code + URL
// from ctx.state.settings.kimi (populated by startKimiLogin).
/** Handles the HTTP route kimi login POST endpoint. */
export default async function (ctx: Context, _session: Session | null, _opts: {
        /** Incoming HTTP request. */ req: Request;
        /** Route parameters captured from the request path. */ params: Record<string, string> }) {
    await ctx.fns.settings.startKimiLogin({});
    return new Response(null, { status: 303, headers: { location: "/settings" } });
}
