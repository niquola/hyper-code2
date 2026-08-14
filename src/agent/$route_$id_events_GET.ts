/** Handles the id events get HTTP route.  * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request;
        /** Values bound to the operation. */
params: Record<string, string> }) {
    const id = opts.params.id!;
    let agent = (ctx.state as any).agent?.[id];
    if (!agent) {
        agent = (await ctx.fns.session?.load?.({ id })) ?? null;
        if (agent) {
            (ctx.state as any).agent ??= {};
            (ctx.state as any).agent[id] = agent;
        }
    }
    if (!agent) return Response.json({ error: 'not found' }, { status: 404 });

    const url = new URL(opts.req.url);
    const offset = Number(url.searchParams.get('offset') ?? '0') || 0;
    const events = await ctx.fns.session.getEvents({ id, fromIdx: offset });
    const maxIdx = await ctx.fns.session.getMaxEventIdx({ id });
    const lastAssistant = [...events].reverse().find((ev: any) => ev?.type === 'assistant');
    const usage = lastAssistant?.usage ?? null;

    const row = ((await ctx.fns.procs.db.select({
        sql: 'SELECT run_state, next_run_at FROM agents WHERE id = ?',
        params: [id],
    })) as any[])[0];
    const isStreaming = row?.run_state === 'running' || !!row?.next_run_at;

    return Response.json({
        id: agent.id,
        model: agent.model,
        events,
        nextOffset: maxIdx + 1,
        isStreaming,
        usage,
    });
}
