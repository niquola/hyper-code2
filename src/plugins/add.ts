// Add a catalogue, git, npm, or explicitly configured plugin.
/** Adds and mounts a configured plugin. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { /** Runtime, plugin, or tool name. */ name: string; /** Value for git. */ git?: string; /** Value for npm. */ npm?: string; /** Value for config. */ config?: Record<string, any> },
) {
    const name = String(opts.name ?? "").trim();
    if (!name) throw new Error("plugins.add: name is required");
    if (opts.npm) {
        return await ctx.fns.procs.modules.add({ name, config: { ...opts.config, npm: opts.npm } });
    }
    return await ctx.fns.procs.modules.add({ name, git: opts.git, config: opts.config });
}
