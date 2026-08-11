// The agents rail's CONTENT — agents grouped by their workdir (the folder is
// the project, so it is the heading), one line per agent: a running light,
// the title with the id in brackets, and a WhatsApp-style unread badge.
// Served by GET /ui/rail and pulled in by the one-line placeholder in
// layout.ts (`hx-trigger="load, every 10s"`), so the layout never awaits the
// list and the badges/lights stay fresh without redrawing the page. Switching
// agents is still a full page load (hx-boost="false"): the chat column must
// re-render.
export default async function (ctx: Context, _session: Session | null, opts: { currentId?: string; archived?: boolean }): Promise<string> {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const agents = await ctx.fns.session.list({ includeArchived: opts.archived === true }).catch(() => []);

    const row = (a: any, depth = 0) => {
        const on = a.id === opts.currentId;
        const gone = a.archivedAt != null;
        // The light: green and pulsing while the agent is doing something,
        // grey when idle. The badge: assistant messages the reader has not had
        // on screen — never shown for the open agent, whose poll IS reading.
        const light = a.runState !== "idle"
            ? `<span class="shrink-0 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="${esc(a.runState)}"></span>`
            : `<span class="shrink-0 h-2 w-2 rounded-full bg-gray-300" title="idle"></span>`;
        const badge = !on && a.unread > 0
            ? `<span class="shrink-0 min-w-[1.1rem] rounded-full bg-emerald-500 px-1 text-center text-[10px] font-semibold leading-4 text-white" ${ctx.fns.procs.ui.attr({ role: "unread" })}>${a.unread > 99 ? "99+" : a.unread}</span>`
            : "";
        const subagent = depth > 0
            ? `<span class="shrink-0 rounded bg-indigo-50 px-1 py-0.5 text-[9px] font-medium text-indigo-500" title="subagent of ${esc(a.parentId)}">sub</span>`
            : "";
        const inner = `${light}
      <span class="min-w-0 flex-1 truncate text-xs ${on ? "text-gray-900 font-semibold" : "text-gray-700"}">${gone ? '<i class="ph ph-archive text-gray-400"></i> ' : ""}${esc(a.title)} <span class="font-mono font-normal text-[10px] text-gray-400">(${esc(a.id)})</span></span>
      ${subagent}
      ${badge}`;
        if (gone) return `<div class="flex items-center gap-1.5 rounded px-2 py-1 opacity-60 hover:opacity-100 hover:bg-gray-200" ${ctx.fns.procs.ui.attr({ entity: "agent", id: a.id, status: "archived" })}>
      <a href="/agent/${encodeURIComponent(a.id)}" hx-boost="false" title="${esc(a.title)}" class="min-w-0 flex-1 flex items-center gap-1.5">${inner}</a>
      <button title="unarchive" hx-post="/agent/${encodeURIComponent(a.id)}/unarchive" hx-swap="none"
        hx-on::after-request="htmx.trigger('#agents-rail', 'rail-refresh')"
        ${ctx.fns.procs.ui.attr({ action: "unarchive", entity: "agent", id: a.id })}
        class="shrink-0 px-1 text-gray-400 hover:text-gray-700"><i class="ph ph-arrow-counter-clockwise"></i></button>
    </div>`;
        return `<a href="/agent/${encodeURIComponent(a.id)}" hx-boost="false" title="${esc(a.title)}"
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
        const node = (a: any, depth: number): string => {
            if (seen.has(a.id)) return "";
            seen.add(a.id);
            const nested = (children.get(a.id) ?? []).map(child => node(child, depth + 1)).join("");
            return `<div class="${depth ? "ml-3 pl-1" : ""}">${row(a, depth)}${nested}</div>`;
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

    return `<div class="flex items-center justify-between px-2 py-2 border-b border-gray-200">
    <span class="text-[11px] font-medium uppercase tracking-wide text-gray-500">Agents</span>
    <span class="flex items-center gap-1">
    <button title="${opts.archived ? "hide archived" : "show archived"}" ${ctx.fns.procs.ui.attr({ action: "toggle-archived", status: opts.archived ? "on" : "off" })}
       onclick="localStorage.setItem('rail-archived', '${opts.archived ? "" : "1"}'); htmx.trigger('#agents-rail', 'rail-refresh')"
       class="px-1.5 py-0.5 rounded border text-xs ${opts.archived ? "border-amber-300 bg-amber-50 text-amber-700" : "border-gray-300 bg-white text-gray-500 hover:bg-gray-50"}"><i class="ph ph-archive"></i></button>
    <a href="/agent/new" hx-get="/agent/new?popup=1" hx-target="#modal" hx-swap="innerHTML" hx-boost="false" title="new agent" ${ctx.fns.procs.ui.attr({ action: "new", entity: "agent" })}
       class="px-1.5 py-0.5 rounded border border-gray-300 bg-white text-xs hover:bg-gray-50">+</a>
    </span>
  </div>
  <div class="flex-1 overflow-y-auto p-1.5">${body || `<p class="px-2 py-1 text-[11px] text-gray-400">no agents yet</p>`}</div>`;
}
