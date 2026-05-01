export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    const agent = (ctx.state as any).agent?.[id];
    if (!agent) return Response.json({ error: 'not found' }, { status: 404 });

    const now = Date.now();
    const jobs = ctx.fns.db.select<any>(ctx,
        'SELECT id, status, debounce_until, created_at, started_at, finished_at, abort_reason, error, payload_json FROM agent_jobs WHERE agent_id = ? ORDER BY created_at ASC',
        [id],
    );

    const mapped = jobs.map((j: any) => {
        const payload = JSON.parse(j.payload_json || '{}');
        return {
            id: j.id,
            status: j.status,
            debounceUntil: j.debounce_until,
            createdAt: j.created_at,
            startedAt: j.started_at,
            finishedAt: j.finished_at,
            abortReason: j.abort_reason ?? null,
            error: j.error ?? null,
            force: payload.force === true,
            queueOnly: payload.queueOnly === true,
            debounceSeconds: Number(payload.debounceSeconds ?? 0),
            textPreview: String(payload.text ?? '').slice(0, 120),
            waitingMs: j.status === 'queued' ? Math.max(0, Number(j.debounce_until ?? now) - now) : 0,
        };
    });

    const queuedCount = mapped.filter((j: any) => j.status === 'queued').length;
    const running = mapped.find((j: any) => j.status === 'running') ?? null;

    return Response.json({
        agent: {
            id: agent.id,
            model: agent.model,
            isStreaming: agent.isStreaming,
            currentJobId: agent.currentJobId ?? null,
            queuedCount,
            running,
            jobs: mapped,
        },
    });
}
