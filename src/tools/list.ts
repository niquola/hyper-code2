// Every declared tool, with the name the MODEL sees resolved.
//
// Registry keys are "<module>.<name>" and always unique. The wire name has to
// match /^[a-zA-Z0-9_-]+$/ for every provider, so a dot is not an option:
// a tool whose short name is claimed by exactly one module keeps it (`read`,
// `write`), and a collision disambiguates both sides to "<module>_<name>".
// Sorted by key, so the wire name a tool gets never depends on scan order —
// and neither does the prefix cache that has those definitions baked into it.
export default function (
    ctx: Context,
    _session: Session | null,
    _opts: { module?: string } = {},
): any[] {
    const registry: Map<string, any> = (ctx.state as any).tools?.registry ?? new Map();
    const all = [...registry.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)));

    const claims = new Map<string, number>();
    for (const t of all) claims.set(t.name, (claims.get(t.name) ?? 0) + 1);

    const out = all.map(t => ({
        ...t,
        wireName: (claims.get(t.name) ?? 0) > 1 ? `${String(t.module).replaceAll(".", "_")}_${t.name}` : t.name,
    }));

    return _opts?.module ? out.filter(t => t.module === _opts.module) : out;
}
