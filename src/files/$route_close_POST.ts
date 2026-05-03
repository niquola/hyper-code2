// POST /files/close?path=... — remove from open tabs, redirect back.
export default async function (ctx: Context, _session: any, req: any) {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") ?? "";
    ctx.fns.files.close(ctx, { path });
    const back = req.headers.get("referer") ?? "/files";
    return new Response(null, { status: 303, headers: { location: back } });
}
