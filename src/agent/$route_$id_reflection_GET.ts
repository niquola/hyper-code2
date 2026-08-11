export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    let agent = (ctx.state as any).agent?.[id];
    if (!agent) agent = await ctx.fns.session.load({ id });
    if (!agent) return new Response('not found', { status: 404 });

    const row = ((await ctx.fns.procs.db.select({ sql: 'SELECT reflection FROM agents WHERE id = ?', params: [id] })) as any[])[0];
    agent.reflection = row?.reflection == null ? null : (typeof row.reflection === 'string' ? JSON.parse(row.reflection) : row.reflection);
    return new Response(ctx.fns.ui.reflectionDropdown({ agent }), { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
