// INSERT / UPDATE / DELETE → { changes, lastInsertRowid, rows }.
// `changes` comes from the command tag; `lastInsertRowid` has no Postgres
// equivalent and is always 0 — use db.insert (RETURNING id) when the id is
// needed. RETURNING queries also come through here fine: rows carries them.
export default async function (ctx: Context, _session: Session | null, opts: { sql: string; params?: any }) {
    const sql = await ctx.fns.procs.db.conn();
    const p = opts.params == null ? [] : Array.isArray(opts.params) ? opts.params : [opts.params];
    const res: any = await sql.unsafe(ctx.fns.procs.db.toPg({ sql: opts.sql }), p);
    return { changes: Number(res?.count ?? res?.length ?? 0), lastInsertRowid: 0, rows: Array.from(res ?? []) };
}
