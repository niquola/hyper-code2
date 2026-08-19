/** Rebuilds the full-text projection for all or selected knowledge entities. */
export default async function (ctx: Context, _session: Session | null, opts: {
    /** Entity IDs to refresh; omit for all entities. */ ids?: string[];
} = {}): Promise<{ indexed: number }> {
    await ctx.fns.knowledge.ensure({});
    const ids = opts.ids?.filter(Boolean) ?? [];
    const where = ids.length ? `WHERE e.id IN (${ids.map(() => "?").join(",")})` : "";
    const rows = await ctx.fns.procs.db.select({ sql: `SELECT e.id,e.type,e.data FROM knowledge.entities e ${where}`, params: ids });
    for (const row of rows) {
        const data = row.data ?? {};
        const scalar = (value: any): string[] => value == null ? [] : Array.isArray(value) ? value.flatMap(scalar) : typeof value === "object" ? Object.values(value).flatMap(scalar) : [String(value)];
        const classes = [data.base_type, ...(Array.isArray(data.type) ? data.type : data.type ? [data.type] : [])].filter(Boolean).join(" ");
        const facts = Object.entries(data).filter(([key]) => !["title", "summary", "description"].includes(key)).flatMap(([key, value]) => scalar(value).map(item => `${key}: ${item.replace(/^[A-Za-z][\\w-]*\//, "")}`));
        const provenance = await ctx.fns.procs.db.select({ sql: "SELECT attribute,value,evidence,source FROM knowledge.provenance WHERE subject=?", params: [row.id] });
        const evidence = provenance.map((p: any) => [p.attribute, typeof p.value === "string" ? p.value : JSON.stringify(p.value), p.source, p.evidence].filter(Boolean).join(" "));
        const body = [...facts, ...evidence].join("\n");
        const searchText = [data.title ?? "", data.summary ?? "", data.description ?? "", body, classes, row.type].join(" ");
        await ctx.fns.procs.db.run({
            sql: `INSERT INTO knowledge.search(id,type,title,summary,description,body,classes,search_vector,updated_at)
                  VALUES(?,?,?,?,?,?,?,to_tsvector('simple',?),now())
                  ON CONFLICT(id) DO UPDATE SET type=excluded.type,title=excluded.title,summary=excluded.summary,
                    description=excluded.description,body=excluded.body,classes=excluded.classes,
                    search_vector=excluded.search_vector,updated_at=now()`,
            params: [row.id, row.type, data.title ?? null, data.summary ?? null, data.description ?? null, body, classes, searchText],
        });
    }
    if (!ids.length) await ctx.fns.procs.db.run({ sql: "DELETE FROM knowledge.search s WHERE NOT EXISTS (SELECT 1 FROM knowledge.entities e WHERE e.id=s.id)", params: [] });
    return { indexed: rows.length };
}
