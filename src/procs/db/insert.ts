// Insert a row from an object → { id, changes }. Columns/placeholders built
// from keys; RETURNING lifts the generated id when the table has one.
//   ctx.fns.procs.db.insert({ into: "todos", values: { title: "x" } })
/**
 * Insert the db subsystem operation.
 * @param opts.into The into value used by the operation.
 * @param opts.values The values to process.
 */
export default async function (ctx: Context, _session: Session | null, opts: { into: string; values: Record<string, any> }) {
    const keys = Object.keys(opts.values);
    const sql = `INSERT INTO ${opts.into} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")}) RETURNING *`;
    const r = await ctx.fns.procs.db.run({ sql, params: keys.map((k) => opts.values[k]) });
    const row: any = r.rows[0] ?? {};
    return { id: row.id ?? 0, changes: r.changes || r.rows.length };
}
