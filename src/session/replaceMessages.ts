export default async function (ctx: Context, _session: Session | null, opts: { id: string; messages: any[]; ts?: number }): Promise<{ count: number }> {
    const { id, messages } = opts;
    const ts = opts.ts ?? Date.now();
    await ctx.fns.procs.db.run({ sql: 'DELETE FROM messages WHERE agent_id = ?', params: [id] });
    for (let i = 0; i < messages.length; i++) {
        const m: any = messages[i];
        await ctx.fns.procs.db.run({
            sql: `
            INSERT INTO messages (agent_id, idx, role, content, tool_calls, tool_call_id, message_type, ts, excluded_from_llm, excluded_from_cursor)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
            params: [
                id,
                i,
                m.role,
                typeof m.content === "string" ? m.content : (m.content == null ? null : JSON.stringify(m.content)),
                m.tool_calls?.length ? JSON.stringify(m.tool_calls) : null,
                m.tool_call_id ?? null,
                m.message_type ?? "message",
                ts,
                m.excluded_from_llm ? 1 : 0,
                m.excluded_from_cursor ? 1 : 0,
            ],
        });
    }
    await ctx.fns.procs.db.run({ sql: 'UPDATE agents SET updated_at = ? WHERE id = ?', params: [ts, id] });
    return { count: messages.length };
}
