export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    try {
        await ctx.fns.agent.clearReflectionNudge({ id: opts.params.id! });
    } catch (error: any) {
        return new Response(error?.message ?? 'not found', { status: 404 });
    }
    if (opts.req.headers.get('hx-request') === 'true') {
        return new Response('', { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    return new Response(null, { status: 303, headers: { location: `/agent/${encodeURIComponent(opts.params.id!)}` } });
}
