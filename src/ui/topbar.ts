// The tab strip over the page pane: built-in pages + every mounted module that
// ships a top-level page (procs modules metadata, uniskill-style). Boosted into
// #main so the chat column survives every switch.
export default function (ctx: Context, _session: Session | null, opts: { path: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const builtins: Array<[string, string]> = [
        ["/search", "search"],
        ["/files", "files"],
        ["/settings", "settings"],
        ["/procs/modules", "modules"],
    ];
    const moduleTabs: Array<[string, string]> = ((ctx.state as any).procs?.modules ?? [])
        .filter((m: any) => m.tab && !m.self)
        .flatMap((m: any) => (m.routes ?? [])
            .filter((r: string) => /^GET \/[a-z0-9-]+$/i.test(r))
            .map((r: string) => [r.slice(4), m.label ?? m.name] as [string, string]))
        .filter(([href]: [string, string]) => !builtins.some(([b]) => b === href));

    const tab = ([href, label]: [string, string]) => {
        const active = opts.path === href || opts.path.startsWith(href + "/");
        return `<a href="${esc(href)}" ${ctx.fns.procs.ui.attr({ action: "open-tab", id: label })} class="px-3 py-1.5 text-xs rounded-t border-b-2 ${active
            ? "border-gray-800 font-semibold text-gray-900"
            : "border-transparent text-gray-500 hover:text-gray-800"}">${esc(label)}</a>`;
    };

    return `<nav class="h-10 shrink-0 border-b border-gray-300 bg-gray-100 flex items-end px-3 gap-1">
  ${[...builtins, ...moduleTabs].map(tab).join("\n  ")}
  <button title="Menu — ⌘K" onclick="window.__navOpen && window.__navOpen()"
          class="ml-auto mb-1 px-2 py-1 text-xs rounded border border-gray-300 bg-white text-gray-500 hover:text-gray-900">⌘K</button>
</nav>`;
}
