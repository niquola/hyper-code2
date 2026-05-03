export default function (ctx: Context, opts: { id: string; event: any; ts?: number }): { idx: number } {
    const { id, event } = opts;
    const ts = opts.ts ?? Date.now();
    const row = ctx.fns.db.select<any>(ctx, { sql: 'SELECT COALESCE(MAX(idx), -1) AS n FROM events WHERE agent_id = ?', params: [id] })[0];
    const idx = Number(row?.n ?? -1) + 1;
    ctx.fns.db.exec(ctx, { sql: 'INSERT INTO events (agent_id, idx, type, payload, ts) VALUES (?, ?, ?, ?, ?)', params: [id, idx, event.type, JSON.stringify(event), ts] });
    ctx.fns.db.exec(ctx, { sql: 'UPDATE agents SET updated_at = ? WHERE id = ?', params: [ts, id] });
    // Wake any in-process waiters AND broadcast over SSE so browser tabs
    // showing this agent fetch the delta with a short hx-get instead of
    // holding a long-poll connection per tab.
    ctx.fns.agent?.wakeWaiters?.(ctx, { agentId: id });
    ctx.fns.events?.emit?.(ctx, { event: { type: 'agent.event_appended', agentId: id, idx } });
    return { idx };
}
