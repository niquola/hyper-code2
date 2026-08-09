// INSERT / UPDATE / DELETE → { changes, lastInsertRowid }.
export default function (ctx: Context, _session: Session | null, opts: { sql: string; params?: any }) {
    const stmt = ctx.fns.procs.db.conn().query(opts.sql);
    const p = opts.params;
    const r = Array.isArray(p) ? stmt.run(...p) : p != null ? stmt.run(p) : stmt.run();
    return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
}
