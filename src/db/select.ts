// Run a SELECT and return all rows.
export default function <T = any>(
    ctx: Context,
    opts: { sql: string; params?: any[] | Record<string, any> },
): T[] {
    const db = (ctx.state as any).db;
    if (!db) throw new Error("db not connected — call ctx.fns.db.connect first");
    const { sql, params = [] } = opts;
    const q = db.query(sql);
    return (Array.isArray(params) ? q.all(...params) : q.all(params)) as T[];
}
