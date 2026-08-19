/** Searches typed knowledge entities with PostgreSQL full-text ranking. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Natural-language or keyword query. */ query: string;
    /** Optional entity type or types. */ type?: string | string[];
    /** Maximum results. @default 20 @minimum 1 @maximum 100 */ limit?: number;
}): Promise<Array<{ id: string; type: string; title: string | null; summary: string | null; snippet: string; score: number }>> {
    await ctx.fns.knowledge.ensure({});
    const query = String(opts.query ?? "").trim();
    if (!query) throw new Error("knowledge.find: query is required");
    const limit = Math.max(1, Math.min(100, Math.floor(opts.limit ?? 20)));
    const types = (Array.isArray(opts.type) ? opts.type : opts.type ? [opts.type] : []).map(String);
    const typeSql = types.length ? `AND type IN (${types.map(() => "?").join(",")})` : "";
    const rows = await ctx.fns.procs.db.select({
        sql: `WITH q AS (SELECT websearch_to_tsquery('simple', ?) query)
              SELECT id,type,title,summary,left(coalesce(description,body,''),500) snippet,
                     ts_rank_cd(search_vector,q.query)::float8 score
                FROM knowledge.search,q
               WHERE search_vector @@ q.query ${typeSql}
               ORDER BY score DESC,title NULLS LAST LIMIT ?`,
        params: [query, ...types, limit],
    });
    return rows.map((row: any) => ({ ...row, score: Number(row.score) }));
}
