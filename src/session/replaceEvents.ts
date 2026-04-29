export default function (ctx: Context, id: string, events: any[], ts = Date.now()): { count: number } {
    ctx.fns.db.exec(ctx, 'DELETE FROM events WHERE agent_id = ?', [id]);
    events.forEach((e: any, i: number) => {
        ctx.fns.db.exec(ctx, 'INSERT INTO events (agent_id, idx, type, payload, ts) VALUES (?, ?, ?, ?, ?)', [id, i, e.type, JSON.stringify(e), ts]);
    });
    ctx.fns.db.exec(ctx, 'UPDATE agents SET updated_at = ? WHERE id = ?', [ts, id]);
    return { count: events.length };
}
