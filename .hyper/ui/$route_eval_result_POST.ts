export default async function (ctx: Context, _session: any, req: Request) {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.id !== 'string') return Response.json({ error: 'invalid payload' }, { status: 400 });
    const pending = ((ctx.state as any).uiEval ??= { pending: new Map() });
    const entry = pending.pending.get(body.id);
    if (!entry) return Response.json({ error: 'unknown id' }, { status: 404 });
    entry.status = body.ok ? 'ok' : 'error';
    entry.ok = !!body.ok;
    entry.value = body.value ?? null;
    entry.error = body.error ?? null;
    entry.completedAt = Date.now();
    return Response.json({ ok: true, id: body.id });
}
