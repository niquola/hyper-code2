export default function (ctx: Context, id: string, events: any[], ts = Date.now()): { count: number } {
    ctx.fns.db.exec(ctx, { sql: 'DELETE FROM events WHERE agent_id = ?', params: [id] });
    events.forEach((e: any, i: number) => {
        ctx.fns.db.exec(ctx, { sql: 'INSERT INTO events (agent_id, idx, type, payload, ts) VALUES (?, ?, ?, ?, ?)', params: [id, i, e.type, JSON.stringify(e), ts] });
    });
    ctx.fns.db.exec(ctx, { sql: 'UPDATE agents SET updated_at = ? WHERE id = ?', params: [ts, id] });
    return { count: events.length };
}
