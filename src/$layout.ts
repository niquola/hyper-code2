export default function (ctx: Context, opts: { currentId?: string; title?: string; main: string; headExtra?: string }, req?: Request) {
    // Prefer db listing (authoritative), fall back to in-memory in tests without db.
    let agents: any[];
    try {
        agents = ctx.fns.session.list(ctx).map(a => ({ ...a, isStreaming: (ctx.state as any).agent?.[a.id]?.isStreaming ?? false }));
    } catch {
        const store: Record<string, any> = (ctx.state as any).agent ?? {};
        agents = Object.values(store).map((a: any) => {
            const first = a.events?.find((e: any) => e.type === "user");
            return {
                id: a.id,
                model: a.model,
                turns: a.events.filter((e: any) => e.type === "user").length,
                isStreaming: a.isStreaming,
                title: first?.text?.slice(0, 40) ?? "(empty)",
            };
        });
    }
    const openFiles = ctx.fns.files?.listOpen ? ctx.fns.files.listOpen(ctx) : [];
    const currentPath = extractCurrentPath(opts.title);
    const selfUrl = req ? new URL(req.url).pathname + new URL(req.url).search : '';
    const sidebar = renderSidebar(agents, openFiles, opts.currentId, currentPath, selfUrl);
    if (req && req.headers.get("x-hyper-fragment") === "sidebar") return sidebar;
    const pageTitle = opts.title ? `${opts.title} · hyper-code2` : "hyper-code2";
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(pageTitle)}</title>
<script src="https://cdn.tailwindcss.com?plugins=typography"></script>
<script src="https://unpkg.com/htmx.org@2.0.4" defer></script>
<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
  .shiki { background: transparent !important; }
  .assistant pre.shiki { padding: .6em .8em; border-radius: 6px; overflow-x: auto; margin: .4em 0; font-size: 12.5px; line-height: 1.45; }
  .tool pre.shiki { padding: 0; margin: 0; overflow-x: auto; }
</style>
${opts.headExtra ?? ""}
<script src="/ui/control.js" defer></script>
<script src="/events/client.js" defer></script>
</head>
<body class="bg-white text-gray-900 text-sm h-screen"${opts.currentId ? ` data-agent-id="${esc(opts.currentId)}"` : ''}>
<div class="flex h-screen">
  ${sidebar}
  <main class="flex-1 flex flex-col overflow-hidden">${opts.main}</main>
</div>
<script>
window.__hyperRefreshSidebar = async function () {
  try {
    const res = await fetch(location.href, { headers: { 'x-hyper-fragment': 'sidebar' } });
    if (!res.ok) return;
    const html = await res.text();
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const next = wrap.querySelector('aside');
    const cur = document.querySelector('aside');
    if (next && cur) cur.replaceWith(next);
  } catch {}
};
</script>
</body>
</html>`;
}

function renderSidebar(agents: any[], openFiles: string[], currentId?: string, currentPath?: string, selfUrl?: string): string {
    const agentRows = agents.length === 0
        ? `<div class="px-4 py-3 text-xs text-gray-400">no agents yet</div>`
        : agents.map(a => {
            const active = a.id === currentId;
            return `<div class="group flex items-stretch border-b border-gray-200 text-xs hover:bg-gray-100 ${active ? "bg-white font-semibold" : ""}">
<a href="/agent/${encodeURIComponent(a.id)}" class="flex-1 min-w-0 px-4 py-2">
<div class="truncate">${esc(a.title)}</div>
<div class="text-gray-400 font-mono mt-0.5">${esc(a.id)} · ${a.turns} turns${a.isStreaming ? " · ●" : ""}</div>
</a>
<form method="POST" action="/agent/${encodeURIComponent(a.id)}/archive" class="shrink-0 flex">
  <button type="submit" title="archive" class="px-2 text-gray-400 hover:text-amber-600 opacity-0 group-hover:opacity-100">⤓</button>
</form>
<form method="POST" action="/agent/${encodeURIComponent(a.id)}/delete" class="shrink-0 flex" onsubmit="return confirm('delete this agent?')">
  <button type="submit" title="delete" class="px-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100">×</button>
</form>
</div>`;
        }).join("");
    const fileRows = openFiles.map(p => {
        const active = p === currentPath;
        const name = p.split("/").pop() ?? p;
        const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
        return `<div class="group flex items-stretch border-b border-gray-200 text-xs hover:bg-gray-100 ${active ? "bg-white font-semibold" : ""}">
<a href="/files?path=${encodeURIComponent(p)}" class="flex-1 min-w-0 px-4 py-2" title="${esc(p)}">
<div class="truncate">${esc(name)}</div>
${dir ? `<div class="text-gray-400 font-mono mt-0.5 truncate">${esc(dir)}</div>` : ""}
</a>
<form method="POST" action="/files/close?path=${encodeURIComponent(p)}" class="shrink-0 flex">
  <button type="submit" title="close" class="px-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100">×</button>
</form>
</div>`;
    }).join("");
    const refreshUrl = selfUrl || '/';
    return `<aside class="w-64 shrink-0 border-r border-gray-200 flex flex-col bg-gray-50"
       hx-get="${refreshUrl}"
       hx-trigger="every 10s"
       hx-swap="outerHTML"
       hx-headers='{"x-hyper-fragment":"sidebar"}'>
<div class="px-4 py-3 flex items-center gap-3 border-b border-gray-200">
  <a href="/" class="font-semibold text-gray-700 hover:text-gray-900">agents</a>
  <a href="/files" title="files" class="text-gray-500 hover:text-gray-900 text-base leading-none">📁</a>
  <a href="/settings" title="settings" class="text-gray-500 hover:text-gray-900 text-base leading-none">⚙︎</a>
  <a href="/agent/new" class="ml-auto text-xs px-2 py-0.5 border border-gray-300 rounded bg-white hover:bg-gray-100">+ new</a>
</div>
<div class="flex-1 overflow-y-auto">
  ${agentRows}
  ${fileRows ? `<div class="border-t-4 border-gray-300"></div>${fileRows}` : ""}
</div>
</aside>`;
}

function extractCurrentPath(title?: string): string | undefined {
    if (!title) return undefined;
    if (title === "files" || title === "hyper-code2") return undefined;
    return title;
}

function esc(s: any): string {
    return String(s ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[ch]!));
}
