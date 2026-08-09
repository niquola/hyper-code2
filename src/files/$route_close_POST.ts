// POST /files/close?path=... — remove from open tabs, redirect back.
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const url = new URL(opts.req.url);
    const path = url.searchParams.get("path") ?? "";
    ctx.fns.files.close({ path });
    const back = opts.req.headers.get("referer") ?? "/files";
    return new Response(null, { status: 303, headers: { location: back } });
}
