export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    let agent = (ctx.state as any).agent?.[id];
    if (!agent) {
        agent = ctx.fns.session?.load?.(ctx, { id }) ?? null;
        if (agent) {
            (ctx.state as any).agent ??= {};
            (ctx.state as any).agent[id] = agent;
        }
    }
    if (!agent) return Response.json({ error: 'not found' }, { status: 404 });

    const text = await readSubmittedText(req);
    if (!text) return Response.json({ error: 'empty input' }, { status: 400 });

    const url = new URL(req.url);
    const explicitSeconds = url.searchParams.get('debounceSeconds');
    // Priority: ?debounceSeconds query > per-agent setting > declared agent.debounceMs > 5s.
    const perAgent = ctx.fns.settings?.getNumber?.(ctx, {
        module: 'ui', scopeType: 'agent', scopeId: agent.id, key: 'debounceMs',
    });
    const declared = ctx.fns.settings?.getNumber?.(ctx, {
        module: 'agent', scopeType: 'global', key: 'debounceMs',
    });
    const debounceMs = explicitSeconds != null
        ? Math.max(0, Number(explicitSeconds) * 1000)
        : (perAgent ?? declared ?? 5000);
    const sendAt = Date.now() + debounceMs;

    const userAppend = await ctx.fns.session.appendUserMessage(ctx, { id: agent.id, text });
    ctx.fns.session.syncAgentState(ctx, { agent });

    // Schedule (or push back) the next run on the agent row itself.
    // MAX(...) keeps the latest message bumping the debounce window forward.
    ctx.fns.db.exec(ctx, {
        sql: `UPDATE agents
            SET next_run_at = MAX(COALESCE(next_run_at, 0), ?),
                updated_at  = ?
          WHERE id = ?`,
        params: [sendAt, Date.now(), agent.id],
    });
    ctx.fns.agent.wakeWorker(ctx);

    if ((req.headers?.get?.('hx-request') ?? '') === 'true') {
        return new Response(null, { status: 204 });
    }
    // Plain browser HTML form submit (e.g. a <form method="POST"> emitted from
    // an §html marker) — bounce back to the agent page so the user lands on
    // the chat with their submission already in flight. Detect by Accept header
    // preferring text/html and the absence of an XHR/Fetch JSON intent.
    const accept = String(req.headers?.get?.('accept') ?? '');
    const wantsHtml = accept.includes('text/html');
    if (wantsHtml) {
        return new Response(null, { status: 303, headers: { location: `/agent/${encodeURIComponent(agent.id)}` } });
    }
    return Response.json({
        ok: true,
        sendAt,
        messageIdx: userAppend.idx,
    });
}

// Read the user's submitted text. Three input shapes are accepted:
// 1. form `text=...` (the default chat-input single-field form) → use as-is.
// 2. multi-field form (no `text` field present) → serialize every name/value
//    pair into a "key: value" block so an §html-emitted form can collect
//    structured data without the agent having to invent a custom protocol.
// 3. plain text body (non-form Content-Type) → trimmed body.
async function readSubmittedText(req: any): Promise<string> {
    const ct = String(req.headers?.get?.('content-type') ?? '');
    if (ct.startsWith('application/x-www-form-urlencoded') || ct.startsWith('multipart/form-data')) {
        const fd = await req.formData();
        const direct = fd.get('text');
        if (typeof direct === 'string' && direct.trim()) return direct.trim();
        const lines: string[] = [];
        for (const [name, value] of (fd as any).entries()) {
            if (typeof value !== 'string') continue;
            lines.push(`${name}: ${value}`);
        }
        return lines.join('\n').trim();
    }
    return (await req.text()).trim();
}
