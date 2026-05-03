export default function (ctx: Context, opts: { id: string; messages: any[]; ts?: number }): { count: number } {
    const { id, messages } = opts;
    const ts = opts.ts ?? Date.now();
    ctx.fns.db.exec(ctx, { sql: 'DELETE FROM messages WHERE agent_id = ?', params: [id] });
    messages.forEach((m: any, i: number) => {
        ctx.fns.db.exec(ctx, {
            sql: `
            INSERT INTO messages (agent_id, idx, role, content, ts, excluded_from_llm, excluded_from_cursor)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
            params: [
                id,
                i,
                m.role,
                typeof m.content === "string" ? m.content : (m.content == null ? null : JSON.stringify(m.content)),
                ts,
                m.excluded_from_llm ? 1 : 0,
                m.excluded_from_cursor ? 1 : 0,
            ],
        });
    });
    ctx.fns.db.exec(ctx, { sql: 'UPDATE agents SET updated_at = ? WHERE id = ?', params: [ts, id] });
    return { count: messages.length };
}
