// Hot-rescan plugins. `name` is accepted as the public API shape; the scanner
// currently rebuilds the registry as one consistent composition.
export default async function (ctx: Context, _session: Session | null, _opts: { name?: string } = {}) {
    const modules = await ctx.fns.procs.modules.reload({});
    return modules.filter((module: any) => module.plugin);
}
