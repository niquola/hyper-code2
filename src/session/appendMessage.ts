export default function (
    ctx: Context,
    opts: { id: string; message: any; ts?: number },
): { idx: number } {
    const { id, message } = opts;
    const ts = opts.ts ?? Date.now();
    const row = ctx.fns.db.select<any>(ctx, { sql: 'SELECT COALESCE(MAX(idx), -1) AS n FROM messages WHERE agent_id = ?', params: [id] })[0];
    const idx = Number(row?.n ?? -1) + 1;
    ctx.fns.db.exec(ctx, {
        sql: 'INSERT INTO messages (agent_id, idx, role, content, ts, excluded_from_llm, excluded_from_cursor) VALUES (?, ?, ?, ?, ?, ?, ?)',
        params: [
            id,
            idx,
            message.role,
            typeof message.content === "string" ? message.content : (message.content == null ? null : JSON.stringify(message.content)),
            ts,
            message.excluded_from_llm ? 1 : 0,
            message.excluded_from_cursor ? 1 : 0,
        ],
    });
    ctx.fns.db.exec(ctx, { sql: 'UPDATE agents SET updated_at = ? WHERE id = ?', params: [ts, id] });
    return { idx };
}
