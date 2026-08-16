// GET /nav/items?q=… — compact overview/search results for the global menu.
/**
 * Renders navigation menu items, optionally filtered by a search query.
 * @param opts.req Incoming HTTP request containing the optional `q` query.
 * @param opts.params Route parameters supplied by the HTTP runtime.
 */

export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const q = new URL(opts.req.url).searchParams.get("q")?.trim() ?? "";
    const items = await ctx.fns.nav.items({ q, limit: q ? 40 : 500 });
    const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const agents = await ctx.fns.session.list({}).catch(() => [] as any[]);
    const visibleAgents = agents.filter((agent: any) => !agent.parentId);
    const childrenByParent = new Map<string, any[]>();
    for (const candidate of agents as any[]) {
        if (!candidate.parentId || !candidate.delegated) continue;
        const children = childrenByParent.get(String(candidate.parentId)) ?? [];
        children.push(candidate);
        childrenByParent.set(String(candidate.parentId), children);
    }
    const agentByHref = new Map(agents.map((agent: any) => [`/agent/${encodeURIComponent(agent.id)}`, agent]));
    const group = (item: any) => {
        const hint = String(item.hint ?? "").toLowerCase();
        if (hint.includes("agent")) return "Chats";
        if (item.href === "/files" || hint.includes("project") || hint.includes("file")) return "Projects & files";
        if (hint.includes("plugin")) return "Plugins";
        return "System";
    };
    const row = (item: any) => {
        const agent: any = agentByHref.get(item.href);
        if (agent) {
            const active = agent.runState !== "idle";
            const badge = Number(agent.unread ?? 0) > 0
                ? `<span class="min-w-[1.1rem] shrink-0 rounded-full bg-emerald-500 px-1 text-center text-[10px] font-semibold leading-4 text-white">${agent.unread > 99 ? "99+" : agent.unread}</span>`
                : "";
            return `<a href="${esc(item.href)}" class="nav-row flex min-h-7 items-center gap-1.5 rounded px-1.5 py-0.5 text-left outline-none hover:bg-base-200">
  ${ctx.fns.ui.modelLogo({ model: agent.model, active, bare: true, compact: true })}
  <span class="min-w-0 flex-1 truncate text-xs text-base-content/80">${esc(agent.title || agent.id)} <span class="font-mono text-[10px] font-normal text-base-content/45">(${esc(agent.id)})</span></span>
  ${badge}
</a>`;
        }
        return `<a href="${esc(item.href)}" class="nav-row flex min-h-8 items-center gap-2 rounded px-2 py-1 text-sm outline-none hover:bg-base-200/60">
  <i class="ph ${group(item) === "Projects & files" ? "ph-folder" : group(item) === "Plugins" ? "ph-plugs" : "ph-gear"} shrink-0 text-base-content/45"></i>
  <span class="min-w-0 flex-1 truncate">${esc(item.label)}</span>
  ${item.hint ? `<span class="max-w-32 shrink-0 truncate text-[10px] text-base-content/45">${esc(item.hint)}</span>` : ""}
</a>`;
    };
    let html: string;
    const workspaceLabel = (dir: string) => dir.split("/").filter(Boolean).pop() || dir;
    const agentGroups = new Map<string, any[]>();
    for (const agent of visibleAgents as any[]) {
        const dir = String(agent.workspaceDir || "");
        const key = dir || "(no workdir)";
        const list = agentGroups.get(key) ?? [];
        list.push(agent);
        agentGroups.set(key, list);
    }
    const agentRow = (agent: any, nested = false) => row({ href: `/agent/${encodeURIComponent(agent.id)}`, label: agent.title || agent.id, hint: nested ? "subagent" : "agent" });
    const chats = () => [...agentGroups.entries()].map(([dir, list]) => `<section class="mb-2">
  ${dir === "(no workdir)"
      ? `<h4 class="mb-0.5 px-1.5 text-[10px] font-semibold text-base-content/45">${dir}</h4>`
      : `<a href="/files?path=${encodeURIComponent(dir)}" class="nav-row mb-0.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-base-content/60 hover:bg-base-200"><i class="ph ph-folder-open"></i><span class="truncate">${esc(workspaceLabel(dir))}</span></a>`}
  ${list.map((parent: any) => `${agentRow(parent)}${(childrenByParent.get(String(parent.id)) ?? []).map((child: any) => `<div class="ml-5 border-l border-ui-border pl-1">${agentRow(child, true)}</div>`).join("")}`).join("")}
</section>`).join("");
    const projects = () => {
        const folders = [...agentGroups.entries()].filter(([dir]) => dir !== "(no workdir)");
        return folders.map(([dir, list]) => `<a href="/files?path=${encodeURIComponent(dir)}" class="nav-row flex min-h-8 items-center gap-2 rounded px-2 py-1 text-sm outline-none hover:bg-base-200/60">
  <i class="ph ph-folder-open shrink-0 text-base-content/45"></i>
  <span class="min-w-0 flex-1 truncate">${esc(workspaceLabel(dir))}</span>
  <span class="shrink-0 text-[10px] text-base-content/45">${list.length} ${list.length === 1 ? "agent" : "agents"}</span>
</a>`).join("");
    };

    if (q) {
        html = `<div class="p-2">${items.map(row).join("")}</div>`;
    } else {
        const groups = ["Chats", "Projects & files", "Plugins", "System"];
        html = `<div class="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">${groups.map(name => {
            const own = items.filter(item => group(item) === name);
            const content = name === "Chats"
                ? chats()
                : name === "Projects & files"
                    ? `${projects()}${own.map(row).join("")}`
                    : own.map(row).join("");
            return `<section class="min-w-0 p-2.5"><h3 class="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-base-content/45">${name}</h3>${content || `<div class="px-2 py-2 text-xs text-base-content/30">empty</div>`}</section>`;
        }).join("")}</div>`;
    }
    return new Response(html || `<div class="px-4 py-5 text-sm text-base-content/45">nothing</div>`, {
        headers: { "content-type": "text/html; charset=utf-8" },
    });
}
