// The agents rail's CONTENT — agents grouped by their workdir (the folder is
// the project, so it is the heading), one line per agent: a running light,
// the title with the id in brackets, and a WhatsApp-style unread badge.
// Served by GET /ui/rail and pulled in by the one-line placeholder in
// layout.ts, so the layout never awaits the list and the badges/lights stay
// fresh without redrawing the page.
//
// Clicking an agent swaps ONLY the page pane: the rail is not redrawn, so its
// scroll position, open groups and focus survive the switch. The rail sits
// OUTSIDE that pane, so its links carry their own htmx attributes instead of
// inheriting them — nothing about navigation is implied by where a link sits.
export default async function (ctx: Context, _session: Session | null, opts: { currentId?: string; archived?: boolean }): Promise<string> {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    // Open an agent in place: the server answers an hx-request with the page's
    // own content, so it goes straight into #main and the address bar follows.
    const open = (id: string) => `hx-get="/agent/${encodeURIComponent(id)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true"`;
    const agents = await ctx.fns.session.list({ includeArchived: opts.archived === true }).catch(() => []);

    const row = (a: any, depth = 0) => {
        // Selection is applied by ui/$script_rail.js from the URL — see there.
        const on = false;
        const gone = a.archivedAt != null;
        // The model mark doubles as activity state: CSS rotates it while the
        // agent works, avoiding a second status glyph in every row.
        const active = a.runState !== "idle";
        const badge = a.unread > 0
            ? `<span class="shrink-0 min-w-[1.1rem] rounded-full bg-emerald-500 px-1 text-center text-[10px] font-semibold leading-4 text-white" ${ctx.fns.procs.ui.attr({ role: "unread" })}>${a.unread > 99 ? "99+" : a.unread}</span>`
            : "";
        const subagent = depth > 0
            ? `<span class="shrink-0 rounded bg-indigo-50 px-1 py-0.5 text-[9px] font-medium text-indigo-500" title="subagent of ${esc(a.parentId)}">sub</span>`
            : "";
        const inner = `${ctx.fns.ui.modelLogo({ model: a.model, active, bare: true })}
      <span class="min-w-0 flex-1 truncate text-xs ${on ? "text-gray-900 font-semibold" : "text-gray-700"}">${gone ? '<i class="ph ph-archive text-gray-400"></i> ' : ""}${esc(a.title)} <span class="font-mono font-normal text-[10px] text-gray-400">(${esc(a.id)})</span></span>
      ${subagent}
      ${badge}`;
        if (gone) return `<div class="flex items-center gap-1.5 rounded px-2 py-1 opacity-60 hover:opacity-100 hover:bg-gray-200" ${ctx.fns.procs.ui.attr({ entity: "agent", id: a.id, status: "archived" })}>
      <a href="/agent/${encodeURIComponent(a.id)}" ${open(a.id)} title="${esc(a.title)}" class="min-w-0 flex-1 flex items-center gap-1.5">${inner}</a>
      <button title="unarchive" hx-post="/agent/${encodeURIComponent(a.id)}/unarchive" hx-swap="none"
        hx-on::after-request="htmx.trigger('#agents-rail', 'rail-refresh')"
        ${ctx.fns.procs.ui.attr({ action: "unarchive", entity: "agent", id: a.id })}
        class="shrink-0 px-1 text-gray-400 hover:text-gray-700"><i class="ph ph-arrow-counter-clockwise"></i></button>
    </div>`;
        return `<a href="/agent/${encodeURIComponent(a.id)}" ${open(a.id)} title="${esc(a.title)}"
       class="flex items-center gap-1.5 rounded-md px-2 py-1.5 ${on ? "bg-white shadow-sm" : "hover:bg-gray-200/70"}"
       ${ctx.fns.procs.ui.attr({ entity: "agent", id: a.id, status: on ? "current" : a.runState })}>
      ${inner}
    </a>`;
    };

    // Group by workdir: the folder IS the project. Basename as the heading,
    // the full path on hover; groups in the order their newest agent has.
    const groups = new Map<string, any[]>();
    for (const a of agents) {
        const dir = a.workspaceDir || "(no workdir)";
        if (!groups.has(dir)) groups.set(dir, []);
        groups.get(dir)!.push(a);
    }
    const renderTree = (list: any[]) => {
        const ids = new Set(list.map(a => a.id));
        const children = new Map<string, any[]>();
        for (const a of list) {
            if (!a.parentId || !ids.has(a.parentId)) continue;
            if (!children.has(a.parentId)) children.set(a.parentId, []);
            children.get(a.parentId)!.push(a);
        }
        const seen = new Set<string>();
        const descendants = (a: any): any[] => (children.get(a.id) ?? []).flatMap(child => [child, ...descendants(child)]);
        const node = (a: any, depth: number): string => {
            if (seen.has(a.id)) return "";
            seen.add(a.id);
            const direct = children.get(a.id) ?? [];
            const allChildren = descendants(a);
            const nested = direct.map(child => node(child, depth + 1)).join("");
            if (!direct.length) return `<div class="${depth ? "ml-3 pl-1" : ""}">${row(a, depth)}</div>`;

            const containsCurrent = allChildren.some(child => child.id === opts.currentId);
            const activeChildren = allChildren.filter(child => child.runState !== "idle").length;
            const unreadChildren = allChildren.reduce((sum, child) => sum + Number(child.unread ?? 0), 0);
            const badgeTitle = `${allChildren.length} subagent${allChildren.length === 1 ? "" : "s"}${activeChildren ? ` · ${activeChildren} active` : ""}${unreadChildren ? ` · ${unreadChildren} unread` : ""}`;
            const childBadge = `<span title="${esc(badgeTitle)}" class="ml-auto inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-indigo-100 px-1 text-[10px] font-semibold leading-4 text-indigo-600">${allChildren.length}</span>`;
            return `<details class="${depth ? "ml-3 pl-1" : ""} group/subagents" ${containsCurrent ? "open" : ""}>
              <summary class="flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
                <span class="min-w-0 flex-1">${row(a, depth)}</span>${childBadge}<i class="ph ph-caret-right text-[10px] text-gray-400 transition-transform group-open/subagents:rotate-90"></i>
              </summary>
              <div class="mt-0.5">${nested}</div>
            </details>`;
        };
        const roots = list.filter(a => !a.parentId || !ids.has(a.parentId));
        const html = roots.map(a => node(a, 0)).join("");
        // A malformed cycle must not make an agent disappear from navigation.
        return html + list.filter(a => !seen.has(a.id)).map(a => node(a, 0)).join("");
    };
    const body = [...groups.entries()].map(([dir, list]) => `
  <div ${ctx.fns.procs.ui.attr({ entity: "workdir", id: dir })}>
    <div class="px-2 pt-2 pb-0.5 text-xs font-medium text-gray-500 truncate" title="${esc(dir)}">
      <i class="ph ph-folder-simple align-middle text-gray-400"></i> ${esc(dir.split("/").filter(Boolean).pop() ?? dir)}
    </div>
    <div class="ml-3 space-y-0.5 pl-1.5">${renderTree(list)}</div>
  </div>`).join("");

    // The only visible entry to navigation, uniskill-style: one button (or ⌘K)
    // opens the filterable palette over nav.items. A tab strip could only ever
    // show the handful of pages that fit in it; the palette shows every page
    // every mounted module ships, plus every agent, and it costs no chrome.
    return `<div class="flex items-center gap-1.5 px-2 py-2 border-b border-gray-200">
    <button title="Menu — ⌘K" aria-label="Menu" onclick="window.__navOpen && window.__navOpen()"
       ${ctx.fns.procs.ui.attr({ action: "open-menu" })}
       class="inline-flex size-6 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-200 hover:text-gray-900"><i class="ph ph-list"></i></button>
    <span class="min-w-0 flex-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">Agents</span>
    <span class="flex items-center gap-1">
    <a href="/llms" title="LLM connections" ${ctx.fns.procs.ui.attr({ action: "open", entity: "llms" })}
       class="inline-flex size-6 items-center justify-center rounded border border-gray-300 bg-white text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-900"><i class="ph ph-plugs-connected"></i></a>
    <button title="${opts.archived ? "hide archived" : "show archived"}" ${ctx.fns.procs.ui.attr({ action: "toggle-archived", status: opts.archived ? "on" : "off" })}
       onclick="localStorage.setItem('rail-archived', '${opts.archived ? "" : "1"}'); htmx.trigger('#agents-rail', 'rail-refresh')"
       class="px-1.5 py-0.5 rounded border text-xs ${opts.archived ? "border-amber-300 bg-amber-50 text-amber-700" : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"}"><i class="ph ph-archive"></i></button>
    <a href="/agent/new" hx-get="/agent/new?popup=1" hx-target="#modal" hx-swap="innerHTML" hx-boost="false" title="new agent" ${ctx.fns.procs.ui.attr({ action: "new", entity: "agent" })}
       class="px-1.5 py-0.5 rounded border border-gray-300 bg-white text-xs hover:bg-gray-50">+</a>
    </span>
  </div>
  <div class="flex-1 overflow-y-auto p-1.5">${body || `<p class="px-2 py-1 text-[11px] text-gray-400">no agents yet</p>`}</div>`;
}
