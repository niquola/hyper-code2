// POST /files?path=... — save content (from <textarea name="content">).
// Redirects back to GET /files?path=... so the browser shows the fresh state.
export default async function (ctx: Context, _session: any, req: any) {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") ?? "";
    if (!path) return new Response("missing ?path", { status: 400 });
    const form = await req.formData();
    const content = (form.get("content") as string) ?? "";
    await ctx.fns.files.write(ctx, { path, content });
    return new Response(null, {
        status: 303,
        headers: { location: `/files?path=${encodeURIComponent(path)}` },
    });
}
