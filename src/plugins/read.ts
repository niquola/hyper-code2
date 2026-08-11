// Read one mounted plugin: compact metadata plus its agent-facing SKILL.md.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { name: string; maxChars?: number },
) {
    const name = String(opts.name ?? "").trim();
    const plugin = (ctx.fns.procs.modules.list({}) as any[]).find((module: any) =>
        module.plugin && (module.name === name || module.namespaces?.includes(name)),
    );
    if (!plugin) throw new Error(`plugins.read: mounted plugin "${name}" not found`);

    let skill: { path: string; text: string; truncated: boolean } | null = null;
    if (plugin.skill) {
        const full = await Bun.file(plugin.skill).text().catch(() => null);
        if (full === null) throw new Error(`plugins.read: ${plugin.skill} is not readable`);
        const maxChars = Math.max(1, Math.min(Number(opts.maxChars ?? 20_000), 100_000));
        skill = { path: plugin.skill, text: full.slice(0, maxChars), truncated: full.length > maxChars };
    }
    return {
        name: plugin.name,
        label: plugin.label,
        description: plugin.description,
        path: plugin.dir,
        namespaces: plugin.namespaces,
        functions: plugin.fns.length,
        routes: plugin.routes.length,
        source: plugin.source,
        skill,
    };
}
