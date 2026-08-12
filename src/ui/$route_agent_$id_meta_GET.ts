export default async function (ctx: Context, _session: Session | null, opts: { params: Record<string, string> }) {
    const id = opts.params.id!;
    const agent = await ctx.fns.session.load({ id });
    if (!agent) return new Response('not found', { status: 404 });
    return new Response(ctx.fns.ui.agentMetaPanel({ agent }), { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
