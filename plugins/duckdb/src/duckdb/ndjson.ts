// Convenience query builder for NDJSON/JSONL logs. SQL fragments are explicit
// because DuckDB expressions are the feature; path and numeric limit are safe.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { path: string; select?: string; where?: string; groupBy?: string; orderBy?: string; limit?: number; maxRows?: number; timeout?: number },
) {
    const source = ctx.fns.duckdb.source({ path: opts.path });
    if (source.format !== "ndjson") throw new Error("duckdb.ndjson: path must be .ndjson or .jsonl");
    const limit = Math.max(1, Math.min(Number(opts.limit ?? 100), 10_000));
    const sql = [
        `SELECT ${String(opts.select || "*")} FROM ${source.table}`,
        opts.where ? `WHERE ${opts.where}` : "",
        opts.groupBy ? `GROUP BY ${opts.groupBy}` : "",
        opts.orderBy ? `ORDER BY ${opts.orderBy}` : "",
        `LIMIT ${limit}`,
    ].filter(Boolean).join("\n");
    return { sql, ...(await ctx.fns.duckdb.query({ sql, maxRows: opts.maxRows ?? limit, timeout: opts.timeout })) };
}
