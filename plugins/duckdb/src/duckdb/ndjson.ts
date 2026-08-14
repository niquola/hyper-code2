/**
 * Builds and runs an explicit SQL query over an NDJSON or JSONL file.
 *
 * SQL fragments are intentionally passed through as DuckDB expressions; the
 * source path and numeric bounds are handled safely by the plugin.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** NDJSON or JSONL source file. */
        path: string;
        /** SQL SELECT expression list. @default * */
        select?: string;
        /** SQL predicate without the `WHERE` keyword. */
        where?: string;
        /** SQL grouping expressions without the `GROUP BY` keywords. */
        groupBy?: string;
        /** SQL ordering expressions without the `ORDER BY` keywords. */
        orderBy?: string;
        /** SQL LIMIT, clamped to 1–10,000. @default 100 @minimum 1 @maximum 10000 */
        limit?: number;
        /** Maximum returned rows, clamped to 1–10,000. Defaults to `limit`. @minimum 1 @maximum 10000 */
        maxRows?: number;
        /** DuckDB process timeout in seconds. @default 30 @minimum 1 @maximum 300 */
        timeout?: number;
    },
): Promise<{ sql: string; rows: any[]; rowCount: number; truncated: boolean }> {
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
