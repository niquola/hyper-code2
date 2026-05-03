export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    delete (ctx.state as any).agent?.[id];
    try { ctx.fns.session.archive(ctx, { id }); } catch (e: any) { console.error('[session.archive]', e?.message); }
    return new Response(null, { status: 303, headers: { location: '/?archived=' + encodeURIComponent(id) } });
}
