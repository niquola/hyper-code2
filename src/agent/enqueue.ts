export default function (
    ctx: Context,
    agent: types.agent.Agent,
    text: string,
    opts: { debounceSeconds?: number; messageIdx?: number } = {},
) {
    const now = Date.now();
    const debounceSeconds = Number.isFinite(opts.debounceSeconds) ? Math.max(0, Number(opts.debounceSeconds)) : 5;
    const sendAt = now + debounceSeconds * 1000;

    const id = 'job_' + crypto.randomUUID().slice(0, 8);
    const payload = {
        text,
        messageIdx: opts.messageIdx ?? null,
        debounceSeconds,
    };

    ctx.fns.db.exec(ctx,
        'INSERT INTO agent_jobs (id, agent_id, kind, status, payload_json, debounce_until, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, agent.id, 'message', 'queued', JSON.stringify(payload), sendAt, now, now],
    );

    ctx.fns.agent?.wakeWorker?.(ctx);

    return { id, sendAt, status: 'queued' };
}
