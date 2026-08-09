// Run raw SQL with no result (DDL / migrations / multiple statements).
export default function (ctx: Context, _session: Session | null, opts: { sql: string }) {
    ctx.fns.procs.db.conn().exec(opts.sql);
    return { ok: true };
}
