// POST /settings/env — save a single env key (form fields: key, value).
export default async function (ctx: Context, _session: any, req: Request) {
    const form = await req.formData();
    const key = String(form.get("key") ?? "");
    const value = String(form.get("value") ?? "");
    if (!key) return new Response("missing key", { status: 400 });
    ctx.fns.settings.saveEnv(ctx, { entries: { [key]: value } });
    return new Response(null, { status: 303, headers: { location: "/settings" } });
}
