// POST /settings/kimi/logout — wipe ~/.kimi/credentials/kimi-code.json.
export default async function (ctx: Context, _session: Session | null, _opts: { req: Request; params: Record<string, string> }) {
    await ctx.fns.settings.logoutKimi({});
    return new Response(null, { status: 303, headers: { location: "/settings" } });
}
