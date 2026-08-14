// Lifecycle: run pending migrations at boot (after db connects). List "migrate"
// in package.json proc.prod after "db" so the schema is current before traffic.
/**
 * Start the migrate subsystem.
 */
export default async function (ctx: Context, _session: Session | null, _config?: any) {
    if (ctx.state.procs?.migrate?.list?.length) await ctx.fns.procs.migrate.up({});
}
