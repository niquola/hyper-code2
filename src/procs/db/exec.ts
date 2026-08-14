// Run raw SQL with no result (DDL / migrations / multiple statements).
// No params — multi-statement strings go through the simple query protocol.
/**
 * Execute exec for the db subsystem.
 * @param opts.sql The SQL statement to execute.
 */
export default async function (ctx: Context, _session: Session | null, opts: { sql: string }) {
    const query = async () => {
        const sql = await ctx.fns.procs.db.conn();
        await sql.unsafe(opts.sql);
        return { ok: true };
    };
    const telemetry: any = (ctx.fns.procs as any).telemetry;
    const attrs = typeof telemetry?.dbAttrs === "function" ? telemetry.dbAttrs({ sql: opts.sql }) : {};
    return await (typeof telemetry?.safeSpan === "function" ? telemetry.safeSpan({ name: "db.query", attrs, fn: query }) : query());
}
