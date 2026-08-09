// Run raw SQL with no result (DDL / migrations / multiple statements).
// No params — multi-statement strings go through the simple query protocol.
export default async function (ctx: Context, _session: Session | null, opts: { sql: string }) {
    const sql = await ctx.fns.procs.db.conn();
    await sql.unsafe(opts.sql);
    return { ok: true };
}
