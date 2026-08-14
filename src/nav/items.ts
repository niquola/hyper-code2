// Resources available in the global menu: core pages, agent chats, and the
// installed plugins themselves. Plugin routes are discovered through search
// providers rather than dumped into the default overview.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { q?: string; limit?: number },
): Promise<types.nav.Item[]> {
    const q = (opts.q ?? "").trim().toLowerCase();
    const limit = opts.limit ?? 20;

    const agents = (await ctx.fns.session.list({}).catch(() => [])).map((a: any): types.nav.Item => ({
        label: `${a.id} · ${String(a.title ?? "").slice(0, 60)}`,
        href: `/agent/${encodeURIComponent(a.id)}`,
        hint: `agent · ${a.model} · ${a.turns} turns`,
    }));

    const pages: types.nav.Item[] = [
        { label: "search transcripts", href: "/search", hint: "page" },
        { label: "files", href: "/files", hint: "page" },
        { label: "settings", href: "/settings", hint: "page" },
        { label: "LLM connections", href: "/llms", hint: "page · models and authentication" },
        { label: "modules", href: "/procs/modules", hint: "page" },
        { label: "new agent", href: "/agent/new", hint: "page" },
    ];

    const seenPluginPaths = new Set<string>();
    const plugins: types.nav.Item[] = ctx.fns.plugins.list({})
        .filter((plugin: any) => {
            const identity = plugin.path || plugin.name;
            if (seenPluginPaths.has(identity)) return false;
            seenPluginPaths.add(identity);
            return true;
        })
        .map((plugin: any): types.nav.Item => ({
            label: plugin.label || plugin.name,
            href: `/plugins/${encodeURIComponent(plugin.name)}`,
            hint: `plugin · ${plugin.description || plugin.namespaces?.join(", ") || plugin.name}`,
        }));

    const all = [...pages, ...plugins, ...agents];
    const hit = (i: types.nav.Item) => !q || i.label.toLowerCase().includes(q) || i.href.toLowerCase().includes(q) || (i.hint ?? "").toLowerCase().includes(q);
    return all.filter(hit).slice(0, limit);
}
