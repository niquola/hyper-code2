export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { id: string; message: any; ts?: number },
): Promise<{ idx: number }> {
    const { id, message } = opts;
    const ts = opts.ts ?? Date.now();
    const row = ((await ctx.fns.procs.db.select({ sql: 'SELECT COALESCE(MAX(idx), -1) AS n FROM messages WHERE agent_id = ?', params: [id] })) as any[])[0];
    const idx = Number(row?.n ?? -1) + 1;
    await ctx.fns.procs.db.run({
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
    await ctx.fns.procs.db.run({ sql: 'UPDATE agents SET updated_at = ? WHERE id = ?', params: [ts, id] });
    return { idx };
}
