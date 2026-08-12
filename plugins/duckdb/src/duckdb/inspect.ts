// Describe columns and return a small sample from a local analytics file.
export default async function (ctx: Context, _session: Session | null, opts: { path: string; sample?: number; timeout?: number }) {
    const source = ctx.fns.duckdb.source({ path: opts.path });
    const sample = Math.max(1, Math.min(Number(opts.sample ?? 5), 50));
    const schema = await ctx.fns.duckdb.run({ sql: `DESCRIBE SELECT * FROM ${source.table}`, timeout: opts.timeout });
    const rows = await ctx.fns.duckdb.run({ sql: `SELECT * FROM ${source.table} LIMIT ${sample}`, timeout: opts.timeout });
    return { path: source.path, format: source.format, columns: schema.map((x: any) => ({ name: x.column_name, type: x.column_type, nullable: x.null })), sample: rows };
}
