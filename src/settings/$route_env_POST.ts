// POST /settings/env — save a single env key (form fields: key, value).
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const form = await opts.req.formData();
    const key = String(form.get("key") ?? "");
    const value = String(form.get("value") ?? "");
    if (!key) return new Response("missing key", { status: 400 });
    await ctx.fns.settings.saveEnv({ entries: { [key]: value } });
    return new Response(null, { status: 303, headers: { location: "/settings" } });
}
