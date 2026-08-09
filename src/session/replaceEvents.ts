export default function (ctx: Context, _session: Session | null, opts: { id: string; events: any[]; ts?: number }): { count: number } {
    const { id, events } = opts;
    const ts = opts.ts ?? Date.now();
    ctx.fns.procs.db.run({ sql: 'DELETE FROM events WHERE agent_id = ?', params: [id] });
    events.forEach((e: any, i: number) => {
        ctx.fns.procs.db.run({ sql: 'INSERT INTO events (agent_id, idx, type, payload, ts) VALUES (?, ?, ?, ?, ?)', params: [id, i, e.type, JSON.stringify(e), ts] });
    });
    ctx.fns.procs.db.run({ sql: 'UPDATE agents SET updated_at = ? WHERE id = ?', params: [ts, id] });
    return { count: events.length };
}
