// db module teardown — close the connection.
export default async function (ctx: Context, _session: Session | null, _state?: any) {
    await ctx.fns.procs.db.close();
}
