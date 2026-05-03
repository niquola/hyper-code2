// PUT /files?path=... — save raw text body. Used by the CodeMirror autosave.
export default async function (ctx: Context, _session: any, req: any) {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") ?? "";
    if (!path) return new Response("missing ?path", { status: 400 });
    const content = await req.text();
    await ctx.fns.files.write(ctx, { path, content });
    return new Response(JSON.stringify({ ok: true, bytes: content.length }), {
        headers: { "content-type": "application/json" },
    });
}
