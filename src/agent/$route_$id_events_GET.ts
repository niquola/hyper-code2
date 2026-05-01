export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    let agent = (ctx.state as any).agent?.[id];
    if (!agent) {
        agent = ctx.fns.session?.load?.(ctx, id) ?? null;
        if (agent) {
            (ctx.state as any).agent ??= {};
            (ctx.state as any).agent[id] = agent;
        }
    }
    if (!agent) return Response.json({ error: 'not found' }, { status: 404 });

    const url = new URL(req.url);
    const offset = Number(url.searchParams.get('offset') ?? '0') || 0;
    const events = ctx.fns.session.getEvents(ctx, id, { fromIdx: offset });
    const maxIdx = ctx.fns.session.getMaxEventIdx(ctx, id);
    const lastAssistant = [...events].reverse().find((ev: any) => ev?.type === 'assistant');
    const usage = lastAssistant?.usage ?? null;

    const running = ctx.fns.db.select<any>(ctx,
        'SELECT COUNT(*) AS n FROM agent_jobs WHERE agent_id = ? AND status = ?',
        [id, 'running'],
    )[0];
    const queued = ctx.fns.db.select<any>(ctx,
        'SELECT COUNT(*) AS n FROM agent_jobs WHERE agent_id = ? AND status = ?',
        [id, 'queued'],
    )[0];
    const isStreaming = Number(running?.n ?? 0) > 0 || Number(queued?.n ?? 0) > 0;

    return Response.json({
        id: agent.id,
        model: agent.model,
        events,
        nextOffset: maxIdx + 1,
        isStreaming,
        usage,
    });
}
