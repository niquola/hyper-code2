export default async function (ctx: Context, _session: Session | null, opts: { name: string }) {
    return await ctx.fns.procs.modules.remove({ name: opts.name });
}
