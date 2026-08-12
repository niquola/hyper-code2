// Everything the ⌘K palette can jump to, filtered by opts.q: agents (from the
// store), built-in pages, and every mounted module's top-level GET pages
// (procs modules metadata — uniskill-style: mount a module, get navigation).
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

    const moduleItems: types.nav.Item[] = (((ctx.state as any).procs?.modules ?? []) as any[])
        .filter((m) => !m.self)
        .flatMap((m) => (m.routes ?? [])
            .filter((r: string) => r.startsWith("GET /") && !r.includes(":") && !/\.(js|css|json)$/.test(r))
            .map((r: string): types.nav.Item => ({
                label: `${m.label ?? m.name} — ${r.slice(4)}`,
                href: r.slice(4),
                hint: "module page",
            })));

    // Pages first, agents after: the rail already lists every agent, so with no
    // query typed the palette should show what nothing else on screen does —
    // and it is the only way to reach a page now that the tab strip is gone.
    const all = [...pages, ...moduleItems, ...agents];
    const hit = (i: types.nav.Item) => !q || i.label.toLowerCase().includes(q) || i.href.toLowerCase().includes(q) || (i.hint ?? "").toLowerCase().includes(q);
    return all.filter(hit).slice(0, limit);
}
