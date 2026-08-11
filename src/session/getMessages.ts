export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { id: string; includeExcluded?: boolean },
): Promise<any[]> {
    const { id } = opts;
    const includeExcluded = opts.includeExcluded === true;
    const rows = (await ctx.fns.procs.db.select({
        sql: 'SELECT * FROM messages WHERE agent_id = ? AND (? = 1 OR COALESCE(excluded_from_llm, 0) = 0) ORDER BY idx',
        params: [id, includeExcluded ? 1 : 0],
    })) as any[];

    return rows.map((r: any) => {
        const m: any = { role: r.role };
        if (r.content !== null) m.content = r.content;
        // JSONB comes back parsed on some drivers and as text on others.
        if (r.tool_calls != null) m.tool_calls = typeof r.tool_calls === "string" ? JSON.parse(r.tool_calls) : r.tool_calls;
        if (r.tool_call_id != null) m.tool_call_id = r.tool_call_id;
        if (Number(r.excluded_from_llm ?? 0) !== 0) m.excluded_from_llm = true;
        return m;
    });
}
