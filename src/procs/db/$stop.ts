// db module teardown — close the connection.
export default function (ctx: Context, _session: Session | null, _state?: any) {
    ctx.fns.procs.db.close();
}
