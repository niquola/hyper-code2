/** Ensures the isolated news storage schema exists before an operation. */
export default async function (ctx: Context, _session: Session | null, _opts?: {}): Promise<void> { await ctx.fns.procs.migrate.up({}); }
