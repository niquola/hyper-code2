// `bun script/cli.ts migrate` — run pending migrations + show status.
// (db connects lazily; config comes from package.json proc.prod.db / env.)
export default async function (ctx: Context, _session: Session | null, _opts: any) {
    const result = await ctx.fns.procs.migrate.up({});
    return { ...result, status: ctx.fns.procs.migrate.status({}) };
}
