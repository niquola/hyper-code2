// Insert a row from an object → { id }. Columns/placeholders built from keys.
//   ctx.fns.procs.db.insert({ into: "todos", values: { title: "x" } })
export default function (ctx: Context, _session: Session | null, opts: { into: string; values: Record<string, any> }) {
    const keys = Object.keys(opts.values);
    const sql = `INSERT INTO ${opts.into} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`;
    const r = ctx.fns.procs.db.run({ sql, params: keys.map((k) => opts.values[k]) });
    return { id: r.lastInsertRowid, changes: r.changes };
}
