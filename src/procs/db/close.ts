// Close + forget this ctx's connection (next db.* reopens lazily).
export default function (ctx: Context, _session: Session | null, _opts?: {}) {
    const st = ctx.state.procs?.db;
    if (st?.connection) { st.connection.close(); st.connection = undefined; }
    return { ok: true };
}
