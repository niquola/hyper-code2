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
        if (Number(r.excluded_from_llm ?? 0) !== 0) m.excluded_from_llm = true;
        return m;
    });
}
