// Run a SELECT → rows.  (A function is a verb: `db.select`, not `db.query` —
// which also keeps the name free for the type `db/Query.ts`.) params: array,
// bound positionally. `?` placeholders are translated to Postgres $1..$n by
// db.toPg, so call sites keep the portable `?` style.
export default async function (ctx: Context, _session: Session | null, opts: { sql: string; params?: any }): Promise<any[]> {
    const sql = await ctx.fns.procs.db.conn();
    const p = opts.params == null ? [] : Array.isArray(opts.params) ? opts.params : [opts.params];
    const rows = await sql.unsafe(ctx.fns.procs.db.toPg({ sql: opts.sql }), p);
    return Array.from(rows);
}
