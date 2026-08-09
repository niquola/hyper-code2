// Compile a query object → { sql, params } (parameterized, injection-safe).
// A small honeysql-style DSL — composable in code, no string building at call
// sites. Pure (no db access) so it's trivially testable.
//   db.sql({ select: ["id","title"], from: "todos",
//            where: { done: 0, id: [1,2,3] }, orderBy: "id desc", limit: 10 })
//   → { sql: "SELECT id, title FROM todos WHERE done = ? AND id IN (?, ?, ?) ORDER BY id desc LIMIT 10", params: [0,1,2,3] }
export default function (_ctx: Context, _session: Session | null, q: types.procs.db.Query): { sql: string; params: any[] } {
    const cols = !q.select || q.select === "*" ? "*" : (Array.isArray(q.select) ? q.select.join(", ") : q.select);
    const params: any[] = [];
    let sql = `SELECT ${cols} FROM ${q.from}`;
    const clause = whereClause(q.where, params);
    if (clause) sql += ` WHERE ${clause}`;
    if (q.orderBy) sql += ` ORDER BY ${q.orderBy}`;
    if (q.limit != null) sql += ` LIMIT ${Number(q.limit)}`;
    if (q.offset != null) sql += ` OFFSET ${Number(q.offset)}`;
    return { sql, params };
}

function whereClause(where: Record<string, any> | undefined, params: any[]): string {
    if (!where) return "";
    const parts: string[] = [];
    for (const [col, v] of Object.entries(where)) {
        if (Array.isArray(v)) {
            parts.push(`${col} IN (${v.map(() => "?").join(", ")})`);
            params.push(...v);
        } else if (v && typeof v === "object") {
            // { col: { ">": n } } — one entry per operator, AND-joined. An empty
            // {} contributes no clause (no stray `col  ?`).
            for (const [op, val] of Object.entries(v)) {
                parts.push(`${col} ${op} ?`);
                params.push(val);
            }
        } else if (v === null) {
            parts.push(`${col} IS NULL`);
        } else {
            parts.push(`${col} = ?`);
            params.push(v);
        }
    }
    return parts.join(" AND ");
}
