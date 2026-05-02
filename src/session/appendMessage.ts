export default function (
    ctx: Context,
    id: string,
    message: any,
    ts = Date.now(),
): { idx: number } {
    const row = ctx.fns.db.select<any>(ctx, 'SELECT COALESCE(MAX(idx), -1) AS n FROM messages WHERE agent_id = ?', [id])[0];
    const idx = Number(row?.n ?? -1) + 1;
    ctx.fns.db.exec(ctx,
        'INSERT INTO messages (agent_id, idx, role, content, ts, excluded_from_llm, excluded_from_cursor) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
            id,
            idx,
            message.role,
            typeof message.content === "string" ? message.content : (message.content == null ? null : JSON.stringify(message.content)),
            ts,
            message.excluded_from_llm ? 1 : 0,
            message.excluded_from_cursor ? 1 : 0,
        ],
    );
    ctx.fns.db.exec(ctx, 'UPDATE agents SET updated_at = ? WHERE id = ?', [ts, id]);
    return { idx };
}
