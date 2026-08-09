// What the host said about a module in `procs.prod` — its config block, which is
// also where it may insist the module is not optional (`"required": true`).
export default async function (ctx: Context, _session: Session | null, opts: { module: string }): Promise<Record<string, any>> {
    const root = ctx.fns.procs.project.projectRoot({});
    const pkg = await Bun.file(`${root}/package.json`).json().catch(() => ({}));
    return ((pkg.procs ?? pkg.proc)?.prod ?? {})[opts.module] ?? {};
}
