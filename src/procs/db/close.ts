// Close + forget this ctx's pool (next db.* reopens lazily).
export default async function (ctx: Context, _session: Session | null, _opts?: {}) {
    const st = ctx.state.procs?.db;
    if (st?.sql) {
        const sql = st.sql;
        st.sql = undefined;
        ((globalThis as any).__hyperTestPools as Set<any> | undefined)?.delete(sql);
        await sql.close();
    }
    return { ok: true };
}
