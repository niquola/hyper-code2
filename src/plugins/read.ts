/**
 * Reads one mounted plugin's human-written overview and generated live function
 * documentation. SKILL.md describes workflows; TypeScript/JSDoc describes APIs.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Mounted plugin name or namespace. */
        name: string;
        /** Maximum SKILL.md characters. @default 20000 @minimum 1 @maximum 100000 */
        maxChars?: number;
        /** Include generated function documentation. @default true */
        includeFunctions?: boolean;
    },
): Promise<Record<string, any>> {
    const name = String(opts.name ?? "").trim();
    const plugin = (ctx.fns.procs.modules.list({}) as any[]).find((module: any) =>
        module.plugin && (module.name === name || module.namespaces?.includes(name)),
    );
    if (!plugin) throw new Error(`plugins.read: mounted plugin "${name}" not found`);
    let overview: { path: string; markdown: string; truncated: boolean } | null = null;
    if (plugin.skill) {
        const full = await Bun.file(plugin.skill).text().catch(() => null);
        if (full === null) throw new Error(`plugins.read: ${plugin.skill} is not readable`);
        const maxChars = Math.max(1, Math.min(Number(opts.maxChars ?? 20_000), 100_000));
        overview = { path: plugin.skill, markdown: full.slice(0, maxChars), truncated: full.length > maxChars };
    }
    const generated = opts.includeFunctions === false ? null : ctx.fns.plugins.docs({ name: plugin.name });
    return {
        name: plugin.name,
        label: plugin.label,
        description: plugin.description,
        path: plugin.dir,
        domains: plugin.domains ?? [],
        namespaces: plugin.namespaces,
        routes: plugin.routes.length,
        source: plugin.source,
        overview,
        functions: generated?.functions ?? undefined,
    };
}
