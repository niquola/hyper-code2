export default async function (ctx: Context, _session: Session | null, opts: { params: Record<string, string> }) {
    const agent = await ctx.fns.session.load({ id: opts.params.id! });
    if (!agent) return new Response('not found', { status: 404 });
    return new Response(ctx.fns.ui.wakeTimer({ agent }), { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
