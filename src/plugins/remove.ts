/** Removes a mounted plugin. */
export default async function (ctx: Context, _session: Session | null, opts: { /** Runtime, plugin, or tool name. */ name: string }) {
    return await ctx.fns.procs.modules.remove({ name: opts.name });
}
