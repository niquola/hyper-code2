/**
 * Describes columns and samples rows from a local analytics file.
 *
 * Supports NDJSON, JSON, CSV, TSV, and Parquet through `duckdb.source`.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Local analytics file to inspect. */
        path: string;
        /** Number of sample rows, clamped to 1–50. @default 5 @minimum 1 @maximum 50 */
        sample?: number;
        /** DuckDB process timeout in seconds. @default 30 @minimum 1 @maximum 300 */
        timeout?: number;
    },
): Promise<{ path: string; format: string; columns: Array<{ name: string; type: string; nullable: string }>; sample: any[] }> {
    const source = ctx.fns.duckdb.source({ path: opts.path });
    const sample = Math.max(1, Math.min(Number(opts.sample ?? 5), 50));
    const schema = await ctx.fns.duckdb.run({ sql: `DESCRIBE SELECT * FROM ${source.table}`, timeout: opts.timeout });
    const rows = await ctx.fns.duckdb.run({ sql: `SELECT * FROM ${source.table} LIMIT ${sample}`, timeout: opts.timeout });
    return { path: source.path, format: source.format, columns: schema.map((x: any) => ({ name: x.column_name, type: x.column_type, nullable: x.null })), sample: rows };
}
