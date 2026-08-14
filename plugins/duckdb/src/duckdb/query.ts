/**
 * Executes read-only DuckDB SQL and returns a bounded JSON result.
 *
 * Statements with write, extension, attachment, or side-effect keywords are
 * rejected. Use `duckdb.ndjson` when a file-oriented query builder is enough.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Read-only DuckDB SQL statement. */
        sql: string;
        /** Optional DuckDB database file; defaults to an in-memory database. */
        db?: string;
        /** Maximum returned rows, clamped to 1–10,000. @default 1000 @minimum 1 @maximum 10000 */
        maxRows?: number;
        /** DuckDB process timeout in seconds. @default 30 @minimum 1 @maximum 300 */
        timeout?: number;
    },
): Promise<{ rows: any[]; rowCount: number; truncated: boolean }> {
    const sql = String(opts.sql ?? "").trim();
    if (!sql) throw new Error("duckdb.query: sql is required");
    // A semicolon inside a string is legal, so this is deliberately a keyword
    // boundary rather than an attempted SQL parser. DuckDB is an analytics tool
    // here; writes and extension/install side effects are outside its contract.
    if (/\b(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|COPY|EXPORT|IMPORT|INSTALL|LOAD|ATTACH|DETACH|CALL|PRAGMA)\b/i.test(stripStrings(sql))) {
        throw new Error("duckdb.query: only read-only SQL is allowed");
    }
    const rows = await ctx.fns.duckdb.run({ sql, db: opts.db, timeout: opts.timeout });
    const maxRows = Math.max(1, Math.min(Number(opts.maxRows ?? 1000), 10_000));
    return { rows: rows.slice(0, maxRows), rowCount: rows.length, truncated: rows.length > maxRows };
}

function stripStrings(sql: string): string {
    return sql.replace(/'(?:''|[^'])*'/g, "''").replace(/"(?:""|[^"])*"/g, '""');
}
