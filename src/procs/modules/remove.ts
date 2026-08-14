// Drop a module from WORKDIR/workspace.json and remount. The clone under
// .workspace/modules stays where it is — removing is un-asking, not deleting, so
// adding it back costs nothing. (The fns it registered live in the running
// registry until a restart, like any deleted file; routes and types rebuild
// immediately, so its tab goes at once.)
//
// Services it was the sole reason for (auto-merged from provides, no explicit
// services.<name> with config) drop off the Services tab after track; a still-
// running process is stopped first so nothing holds the port.
/**
 * Remove the modules subsystem operation.
 * @param opts.name The target name.
 */
export default async function (ctx: Context, _session: Session | null, opts: { name: string }) {
    const file = `${ctx.fns.procs.project.workdir({})}/workspace.json`;
    const manifest = await Bun.file(file).json().catch(() => ({} as any));
    // A project written before the rename says `plugins`; fold it into `modules`
    // on the way through rather than leaving two lists that disagree — everything
    // still READS the old key, nothing writes it any more.
    if (manifest.plugins) { manifest.modules = { ...manifest.plugins, ...manifest.modules }; delete manifest.plugins; }
    if (!manifest.modules?.[opts.name]) throw new Error(`"${opts.name}" is not declared in workspace.json`);

    const before = (ctx.state.procs?.modules ?? []).find((m: any) => m.name === opts.name);
    const provided = before?.provides ?? [];

    delete manifest.modules[opts.name];
    await Bun.write(file, JSON.stringify(manifest, null, 2) + "\n");

    // …and it stops being a skill of this project at the same moment it stops
    // being one of its modules.
    await ctx.fns.procs.modules.unlink({ name: opts.name }).catch(() => null);
    await ctx.fns.procs.modules.reload({});

    // Stop only services that were auto-requested by this module and not given
    // an explicit services.<name> block (those stay — the project asked twice).
    const still = await Bun.file(file).json().catch(() => ({} as any));
    for (const service of provided) {
        if (still.services?.[service] != null) continue;
        if ((ctx.fns as any).services && (ctx.state as any).services?.records?.[service]?.proc) await (ctx.fns as any).services.stop({ name: service }).catch(() => {});
    }
    if ((ctx.fns as any).services) await (ctx.fns as any).services.track({});
    return { removed: opts.name };
}
