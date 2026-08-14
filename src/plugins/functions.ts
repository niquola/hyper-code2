// Functions contributed by one plugin, with live signatures for discovery.
/** Lists runtime functions contributed by a mounted plugin. */
export default function (ctx: Context, _session: Session | null, opts: { /** Runtime, plugin, or tool name. */ name: string }) {
    const name = String(opts.name ?? "").trim();
    const plugin = (ctx.fns.procs.modules.list({}) as any[]).find((module: any) =>
        module.plugin && (module.name === name || module.namespaces?.includes(name)),
    );
    if (!plugin) throw new Error(`plugins.functions: mounted plugin "${name}" not found`);
    return plugin.fns.map((dotted: string) => {
        const raw = dotted.split(".").reduce((node: any, part: string) => node?.[part], ctx.state.registry as any);
        return {
            name: dotted,
            signature: typeof raw === "function" ? raw.toString().slice(0, 400) : null,
        };
    });
}
