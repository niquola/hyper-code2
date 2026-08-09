export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    delete (ctx.state as any).agent?.[id];
    try { ctx.fns.session.archive({ id }); } catch (e: any) { console.error('[session.archive]', e?.message); }
    return new Response(null, { status: 303, headers: { location: '/?archived=' + encodeURIComponent(id) } });
}
