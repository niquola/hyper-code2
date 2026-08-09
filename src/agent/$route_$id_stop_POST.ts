export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    const agent = (ctx.state as any).agent?.[id];
    const url = new URL(opts.req.url);
    const clearQueue = url.searchParams.get('clearQueue') === '1';
    if (agent) ctx.fns.agent.stop({ agent, clearQueue });
    return new Response(null, { status: 303, headers: { location: `/agent/${encodeURIComponent(id)}` } });
}
