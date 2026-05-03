// Insert a row into `table` from an object of column-value pairs.
// Returns { lastInsertRowid, changes }. Values are bound as positional params.
export default function (
    ctx: Context,
    opts: { table: string; row: Record<string, any> },
): { changes: number; lastInsertRowid: number | bigint } {
    const { table, row } = opts;
    if (!/^[A-Za-z_][\w]*$/.test(table)) throw new Error(`bad table name: ${table}`);
    const cols = Object.keys(row);
    if (cols.length === 0) throw new Error("insert requires at least one column");
    for (const c of cols) {
        if (!/^[A-Za-z_][\w]*$/.test(c)) throw new Error(`bad column name: ${c}`);
    }
    const placeholders = cols.map(() => "?").join(", ");
    const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
    const params = cols.map(c => row[c]);
    return ctx.fns.db.exec(ctx, { sql, params });
}
