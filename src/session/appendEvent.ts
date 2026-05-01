export default function (ctx: Context, id: string, event: any, ts = Date.now()): { idx: number } {
    const row = ctx.fns.db.select<any>(ctx, 'SELECT COALESCE(MAX(idx), -1) AS n FROM events WHERE agent_id = ?', [id])[0];
    const idx = Number(row?.n ?? -1) + 1;
    ctx.fns.db.exec(ctx, 'INSERT INTO events (agent_id, idx, type, payload, ts) VALUES (?, ?, ?, ?, ?)', [id, idx, event.type, JSON.stringify(event), ts]);
    ctx.fns.db.exec(ctx, 'UPDATE agents SET updated_at = ? WHERE id = ?', [ts, id]);
    ctx.fns.agent?.wakeWaiters?.(ctx, id);
    return { idx };
}
