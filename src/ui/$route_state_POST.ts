// POST /ui/state — browser beacon with current layout; GET-like callers use
// ctx.fns.ui.state({}) to read the merged durable/live server snapshot.
export default async function (ctx: Context, _session: Session | null, opts: { req: Request }) {
    const body: any = await opts.req.json().catch(() => null);
    if (!body) return new Response("invalid json", { status: 400 });
    const ui = {
        url: String(body.url ?? ""),
        title: String(body.title ?? ""),
        page: body.page == null ? null : String(body.page),
        agentId: body.agentId == null ? null : String(body.agentId),
        viewport: body.viewport && Number.isFinite(body.viewport.width) && Number.isFinite(body.viewport.height)
            ? { width: Number(body.viewport.width), height: Number(body.viewport.height) }
            : null,
        at: new Date().toISOString(),
    };
    (ctx.state.screen ??= { nextId: 1, pending: new Map() } as any).ui = ui;
    return new Response(null, { status: 204 });
}
