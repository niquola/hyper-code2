export default function (
    ctx: Context,
    id: string,
    opts: { includeExcluded?: boolean } = {},
): any[] {
    const includeExcluded = opts.includeExcluded === true;
    const rows = ctx.fns.db.select<any>(ctx,
        'SELECT * FROM messages WHERE agent_id = ? AND (? = 1 OR COALESCE(excluded_from_llm, 0) = 0) ORDER BY idx',
        [id, includeExcluded ? 1 : 0],
    );

    return rows.map((r: any) => {
        const m: any = { role: r.role };
        if (r.content !== null) m.content = r.content;
        if (r.tool_calls !== null) m.tool_calls = JSON.parse(r.tool_calls);
        if (r.tool_call_id !== null) m.tool_call_id = r.tool_call_id;
        if (Number(r.excluded_from_llm ?? 0) !== 0) m.excluded_from_llm = true;
        return m;
    });
}
