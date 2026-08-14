// The agents rail's CONTENT — agents grouped by their workdir (the folder is
// the project, so the heading is a link into the file browser), one line per
// agent: a running light, the title with the id in brackets, and a
// WhatsApp-style unread badge.
// Served by GET /ui/rail and pulled in by the one-line placeholder in
// layout.ts, so the layout never awaits the list and the badges/lights stay
// fresh without redrawing the page.
//
// Clicking an agent swaps ONLY the page pane: the rail is not redrawn, so its
// scroll position, open groups and focus survive the switch. The rail sits
// OUTSIDE that pane, so its links carry their own htmx attributes instead of
// inheriting them — nothing about navigation is implied by where a link sits.

// Agents with no workdir are still grouped, but under a label rather than a
// path — there is no folder to open, so that one heading is not a link.
const NO_WORKDIR = "(no workdir)";
const folderLabel = (dir: string) => dir.split("/").filter(Boolean).pop() ?? dir;
export default async function (ctx: Context, _session: Session | null, opts: { currentId?: string; archived?: boolean }): Promise<string> {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    // Open an agent in place: the server answers an hx-request with the page's
    // own content, so it goes straight into #main and the address bar follows.
    const open = (id: string) => `hx-get="/agent/${encodeURIComponent(id)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true"`;
    // The workdir heading opens that folder in the file browser the same way —
    // only #main is swapped, so the rail keeps its scroll, its open groups and
    // its focus. The path is absolute and stays absolute all the way down:
    // files.resolveSafe resolves a relative path against the CURRENT agent's
    // workspace, which is the wrong base once you are looking at another
    // project's folder.
    const openPath = (dir: string) => `hx-get="/files?path=${encodeURIComponent(dir)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true"`;
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
            ? `<span class="shrink-0 rounded bg-gray-100 px-1 py-0.5 text-[9px] font-medium text-gray-500" title="subagent of ${esc(a.parentId)}">sub</span>`
            : "";
        const inner = `${ctx.fns.ui.modelLogo({ model: a.model, active, bare: true, compact: true })}
      <span class="min-w-0 flex-1 truncate text-xs ${on ? "font-semibold text-gray-950" : "text-gray-700"}">${gone ? '<i class="ph ph-archive text-gray-500"></i> ' : ""}${esc(a.title)} <span class="font-mono font-normal text-[10px] text-gray-500">(${esc(a.id)})</span></span>
      ${subagent}
      ${badge}`;
        if (gone) return `<div class="flex items-center gap-1 px-1.5 py-0.5 opacity-60 hover:bg-gray-200 hover:opacity-100" ${ctx.fns.procs.ui.attr({ entity: "agent", id: a.id, status: "archived" })}>
      <a href="/agent/${encodeURIComponent(a.id)}" ${open(a.id)} title="${esc(a.title)}" class="min-w-0 flex-1 flex items-center gap-1.5">${inner}</a>
      <button title="unarchive" hx-post="/agent/${encodeURIComponent(a.id)}/unarchive" hx-swap="none"
        hx-on::after-request="htmx.trigger('#agents-rail', 'rail-refresh')"
        ${ctx.fns.procs.ui.attr({ action: "unarchive", entity: "agent", id: a.id })}
        class="shrink-0 px-1 text-gray-400 hover:text-gray-900"><i class="ph ph-arrow-counter-clockwise"></i></button>
    </div>`;
        return `<a href="/agent/${encodeURIComponent(a.id)}" ${open(a.id)} title="${esc(a.title)}"
       class="flex items-center gap-1 px-1.5 py-0.5 ${on ? "bg-blue-100 text-blue-950" : "hover:bg-gray-200/80"}"
       ${ctx.fns.procs.ui.attr({ entity: "agent", id: a.id, status: on ? "current" : a.runState })}>
      ${inner}
    </a>`;
    };

    // Group by workdir: the folder IS the project — so the heading is a link to
    // it. Basename as the label, the full path on hover; groups in the order
    // their newest agent has.
    const groups = new Map<string, any[]>();
    for (const a of agents) {
        const dir = a.workspaceDir || NO_WORKDIR;
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
  <section class="border-b border-gray-200" ${ctx.fns.procs.ui.attr({ entity: "workdir", id: dir })}>
    ${dir === NO_WORKDIR
        ? `<div class="flex h-6 items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400"><i class="ph ph-caret-down text-[9px]"></i><span class="truncate" title="${esc(dir)}">${esc(folderLabel(dir))}</span></div>`
        : `<a href="/files?path=${encodeURIComponent(dir)}" ${openPath(dir)} title="${esc(dir)}"
             ${ctx.fns.procs.ui.attr({ action: "open", entity: "workdir", id: dir })}
             class="group flex h-6 items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-700 hover:bg-gray-200 hover:text-gray-950"><i class="ph ph-caret-down text-[9px] text-gray-400 group-hover:text-gray-700"></i><i class="ph ph-folder-open text-gray-400"></i><span class="min-w-0 flex-1 truncate">${esc(folderLabel(dir))}</span><i class="ph ph-files text-xs text-gray-500 opacity-0 group-hover:opacity-100"></i></a>`}
    <div class="space-y-px px-1 pb-0.5 pl-2">${renderTree(list)}</div>
  </section>`).join("");

    // The only visible entry to navigation, uniskill-style: one button (or ⌘K)
    // opens the filterable palette over nav.items. A tab strip could only ever
    // show the handful of pages that fit in it; the palette shows every page
    // every mounted module ships, plus every agent, and it costs no chrome.
    return `<div class="flex h-8 items-center gap-1 border-b border-gray-200 bg-gray-50 px-1.5 text-gray-700">
    <button title="Menu — ⌘K" aria-label="Menu" onclick="window.__navOpen && window.__navOpen()"
       ${ctx.fns.procs.ui.attr({ action: "open-menu" })}
       class="inline-flex size-5 shrink-0 items-center justify-center rounded hover:bg-gray-200 hover:text-gray-950"><i class="ph ph-list"></i></button>
    <span class="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-wider">Explorer</span>
    <span class="flex items-center gap-0.5">
    <a href="/llms" title="LLM connections" ${ctx.fns.procs.ui.attr({ action: "open", entity: "llms" })}
       class="inline-flex size-5 items-center justify-center rounded text-gray-500 hover:bg-gray-200 hover:text-gray-950"><i class="ph ph-plugs-connected"></i></a>
    <button title="${opts.archived ? "hide archived" : "show archived"}" ${ctx.fns.procs.ui.attr({ action: "toggle-archived", status: opts.archived ? "on" : "off" })}
       onclick="localStorage.setItem('rail-archived', '${opts.archived ? "" : "1"}'); htmx.trigger('#agents-rail', 'rail-refresh')"
       class="inline-flex size-5 items-center justify-center rounded ${opts.archived ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-200 hover:text-gray-950"}"><i class="ph ph-archive"></i></button>
    <a href="/agent/new" hx-get="/agent/new?popup=1" hx-target="#modal" hx-swap="innerHTML" hx-boost="false" title="new agent" ${ctx.fns.procs.ui.attr({ action: "new", entity: "agent" })}
       class="inline-flex size-5 items-center justify-center rounded text-gray-500 hover:bg-gray-200 hover:text-gray-950"><i class="ph ph-plus"></i></a>
    </span>
  </div>
  <div class="flex-1 overflow-y-auto bg-gray-50 text-gray-700">${body || `<p class="px-3 py-2 text-[11px] text-gray-500">no agents yet</p>`}</div>`;
}
