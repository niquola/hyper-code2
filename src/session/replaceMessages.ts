export default function (ctx: Context, id: string, messages: any[], ts = Date.now()): { count: number } {
    ctx.fns.db.exec(ctx, 'DELETE FROM messages WHERE agent_id = ?', [id]);
    messages.forEach((m: any, i: number) => {
        ctx.fns.db.exec(ctx, `
            INSERT INTO messages (agent_id, idx, role, content, ts, excluded_from_llm, excluded_from_cursor)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            i,
            m.role,
            typeof m.content === "string" ? m.content : (m.content == null ? null : JSON.stringify(m.content)),
            ts,
            m.excluded_from_llm ? 1 : 0,
            m.excluded_from_cursor ? 1 : 0,
        ]);
    });
    ctx.fns.db.exec(ctx, 'UPDATE agents SET updated_at = ? WHERE id = ?', [ts, id]);
    return { count: messages.length };
}
