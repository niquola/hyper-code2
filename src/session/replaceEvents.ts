export default function (ctx: Context, opts: { id: string; events: any[]; ts?: number }): { count: number } {
    const { id, events } = opts;
    const ts = opts.ts ?? Date.now();
    ctx.fns.db.exec(ctx, { sql: 'DELETE FROM events WHERE agent_id = ?', params: [id] });
    events.forEach((e: any, i: number) => {
        ctx.fns.db.exec(ctx, { sql: 'INSERT INTO events (agent_id, idx, type, payload, ts) VALUES (?, ?, ?, ?, ?)', params: [id, i, e.type, JSON.stringify(e), ts] });
    });
    ctx.fns.db.exec(ctx, { sql: 'UPDATE agents SET updated_at = ? WHERE id = ?', params: [ts, id] });
    return { count: events.length };
}
