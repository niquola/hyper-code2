// Run a mutating SQL statement. Returns { changes, lastInsertRowid }.
export default function (
    ctx: Context,
    sql: string,
    params: any[] | Record<string, any> = [],
): { changes: number; lastInsertRowid: number | bigint } {
    const db = (ctx.state as any).db;
    if (!db) throw new Error("db not connected — call ctx.fns.db.connect first");
    const stmt = db.prepare(sql);
    const res = Array.isArray(params) ? stmt.run(...params) : stmt.run(params);
    return { changes: res.changes ?? 0, lastInsertRowid: res.lastInsertRowid ?? 0 };
}
