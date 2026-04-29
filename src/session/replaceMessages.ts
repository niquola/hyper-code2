export default function (ctx: Context, id: string, messages: any[], ts = Date.now()): { count: number } {
    ctx.fns.db.exec(ctx, 'DELETE FROM messages WHERE agent_id = ?', [id]);
    messages.forEach((m: any, i: number) => {
        ctx.fns.db.exec(ctx, `
            INSERT INTO messages (agent_id, idx, role, content, tool_calls, tool_call_id, ts)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            i,
            m.role,
            typeof m.content === "string" ? m.content : (m.content == null ? null : JSON.stringify(m.content)),
            m.tool_calls ? JSON.stringify(m.tool_calls) : null,
            m.tool_call_id ?? null,
            ts,
        ]);
    });
    ctx.fns.db.exec(ctx, 'UPDATE agents SET updated_at = ? WHERE id = ?', [ts, id]);
    return { count: messages.length };
}
