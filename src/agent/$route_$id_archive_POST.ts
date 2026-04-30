export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    const list = ctx.fns.session.list(ctx);
    const idx = list.findIndex((a: any) => a.id === id);
    delete (ctx.state as any).agent?.[id];
    try { ctx.fns.session.archive(ctx, id); } catch (e: any) { console.error('[session.archive]', e?.message); }
    const remaining = ctx.fns.session.list(ctx);
    const next = remaining[idx] ?? remaining[idx - 1] ?? remaining[0] ?? null;
    return new Response(null, { status: 303, headers: { location: next ? '/agent/' + encodeURIComponent(next.id) : '/' } });
}
