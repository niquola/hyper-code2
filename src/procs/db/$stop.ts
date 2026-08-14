// db module teardown — close the connection.
/**
 * Stop the db subsystem and release its resources.
 */
export default async function (ctx: Context, _session: Session | null, _state?: any) {
    await ctx.fns.procs.db.close();
}
