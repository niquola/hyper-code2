// Run a SELECT → rows.  (A function is a verb: `db.select`, not `db.query` —
// which also keeps the name free for the type `db/Query.ts`.) params: array (positional ?) or object (named $x).
export default function (ctx: Context, _session: Session | null, opts: { sql: string; params?: any }): any[] {
    const stmt = ctx.fns.procs.db.conn().query(opts.sql);
    const p = opts.params;
    return Array.isArray(p) ? stmt.all(...p) : p != null ? stmt.all(p) : stmt.all();
}
