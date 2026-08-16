/**
 * Builds current documentation for one mounted plugin from its live runtime
 * function metadata. Use instead of maintaining signatures in SKILL.md.
 */
export default function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Mounted plugin name or one of its namespaces. */
        name: string;
        /** Include full function JSDoc text. @default true */
        includeDoc?: boolean;
    },
): {
    plugin: { name: string; label: string; description: string; namespaces: string[] };
    functions: Array<Record<string, any>>;
} {
    const name = String(opts.name ?? "").trim();
    const plugin = (ctx.fns.procs.modules.list({}) as any[]).find((module: any) =>
        module.plugin && (module.name === name || module.namespaces?.includes(name)),
    );
    if (!plugin) throw new Error(`plugins.docs: mounted plugin "${name}" not found`);
    const functions = [...new Set(plugin.fns as string[])].sort().map(functionName => {
        const meta = ctx.fns.runtime.docs.get({ name: functionName });
        return {
            name: functionName,
            summary: meta.summary ?? "",
            ...(opts.includeDoc === false ? {} : { doc: meta.doc ?? "" }),
            signature: meta.signature ?? "",
            optsType: meta.optsType ?? "",
            returnType: meta.returnType ?? "",
            paramsSchema: meta.paramsSchema ?? { type: "object", properties: {} },
            rel: meta.rel ?? "",
        };
    });
    return {
        plugin: {
            name: plugin.name,
            label: plugin.label,
            description: plugin.description,
            namespaces: plugin.namespaces ?? [],
        },
        functions,
    };
}
