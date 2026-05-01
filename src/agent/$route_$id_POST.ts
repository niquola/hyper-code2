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

    const userAppend = await ctx.fns.session.appendUserMessage(ctx, agent.id, text);
    ctx.fns.session.syncAgentState(ctx, agent);

    const job = ctx.fns.agent.enqueue(ctx, agent, text, {
        debounceSeconds,
        messageIdx: userAppend.idx,
    });
    // workerLoop is woken by enqueue itself via wakeWorker; the single process-wide loop drains all agents.

    // htmx form submit: empty 204 — long-poll on #msg-tail picks up the new user event from DB.
    // JSON clients still get the legacy shape.
    if ((req.headers?.get?.('hx-request') ?? '') === 'true') {
        return new Response(null, { status: 204 });
    }
    return Response.json({
        ok: true,
        jobId: job.id,
        sendAt: job.sendAt,
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
