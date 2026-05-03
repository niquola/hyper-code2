export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    const agent = (ctx.state as any).agent?.[id];
    const url = new URL(req.url);
    const clearQueue = url.searchParams.get('clearQueue') === '1';
    if (agent) ctx.fns.agent.stop(ctx, { agent, clearQueue });
    return new Response(null, { status: 303, headers: { location: `/agent/${encodeURIComponent(id)}` } });
}
