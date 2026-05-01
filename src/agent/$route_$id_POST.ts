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

    const text = await readSubmittedText(req);
    if (!text) return Response.json({ error: 'empty input' }, { status: 400 });

    const url = new URL(req.url);
    const debounceSeconds = Number(url.searchParams.get('debounceSeconds') ?? '5');
    const debounceMs = Math.max(0, debounceSeconds * 1000);
    const sendAt = Date.now() + debounceMs;

    const userAppend = await ctx.fns.session.appendUserMessage(ctx, agent.id, text);
    ctx.fns.session.syncAgentState(ctx, agent);

    // Schedule (or push back) the next run on the agent row itself.
    // MAX(...) keeps the latest message bumping the debounce window forward.
    ctx.fns.db.exec(ctx,
        `UPDATE agents
            SET next_run_at = MAX(COALESCE(next_run_at, 0), ?),
                updated_at  = ?
          WHERE id = ?`,
        [sendAt, Date.now(), agent.id],
    );
    ctx.fns.agent.wakeWorker(ctx);

    if ((req.headers?.get?.('hx-request') ?? '') === 'true') {
        return new Response(null, { status: 204 });
    }
    return Response.json({
        ok: true,
        sendAt,
        messageIdx: userAppend.idx,
    });
}

async function readSubmittedText(req: any): Promise<string> {
    const ct = String(req.headers?.get?.('content-type') ?? '');
    if (ct.startsWith('application/x-www-form-urlencoded') || ct.startsWith('multipart/form-data')) {
        const fd = await req.formData();
        const v = fd.get('text');
        return typeof v === 'string' ? v.trim() : '';
    }
    return (await req.text()).trim();
}
