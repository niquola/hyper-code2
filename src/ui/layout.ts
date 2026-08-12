// The app's HTML shell — replaces procs' default (`registry.ui.layout` wins over
// `registry.procs.ui.layout` in http/toResponse). Called RAW by toResponse as
// `layout(ctx, session, dressed)`; the request lives on the session.
//
// Workspace-style frame: the agent chat is a persistent column on the LEFT
// (the harness), pages render on the RIGHT under a module tab bar (the
// product). Tab navigation is hx-boosted into #main only, so switching pages
// never redraws the chat or drops its long-poll. Switching AGENTS is a full
// page load on purpose (the chat column must re-render).
export default async function (ctx: Context, session: Session | null, opts: { currentId?: string; title?: string; main: string; headExtra?: string }): Promise<string> {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const path = session?.url?.pathname ?? "/";

    const uiRows = await ctx.fns.procs.db.select({
        sql: "SELECT key, value FROM kv WHERE key IN (?, ?)",
        params: ["ui:rightPanelCollapsed", "ui:chatWidth"],
    }).catch(() => []) as any[];
    const uiPrefs = Object.fromEntries(uiRows.map((row: any) => [row.key, row.value]));
    // Collapsed unless the person asked for it: the workspace pane (module and
    // plugin pages) is the occasional half of the frame, and the conversation
    // is the constant one. The toggle in its header brings it back and the
    // choice is remembered, so this is a default, not a removal.
    const rightPanelCollapsed = (uiPrefs["ui:rightPanelCollapsed"] ?? "1") === "1";
    const chatWidth = /^\d+$/.test(uiPrefs["ui:chatWidth"] ?? "") ? `${uiPrefs["ui:chatWidth"]}px` : "var(--chat-w,26rem)";
    // Whose chat sits on the left is a property of THIS request, never of the
    // server: the page knows it from its own route, or the /a/<agent>/… prefix
    // said so. A process-wide "current agent" made two tabs fight.
    let currentId = opts.currentId ?? session?.req?.headers?.get("x-hyper-agent") ?? undefined;
    if (!currentId) {
        try { currentId = (await ctx.fns.session.list({}))[0]?.id; } catch { /* no db in bare test ctxs */ }
    }
    // Links out of the frame keep the agent in the path, so navigating to
    // another page cannot silently change who you are talking to.
    const withAgent = (href: string) => currentId && href.startsWith("/") && !href.startsWith("/a/") && !href.startsWith("/agent/")
        ? `/a/${currentId}${href === "/" ? "" : href}`
        : href;

    const chat = currentId
        ? await ctx.fns.ui.chatColumn({ agentId: currentId })
        : `<div class="flex-1 flex items-center justify-center text-gray-400 text-sm">
             <a href="/agent/new" hx-boost="false" class="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100">+ new agent</a>
           </div>`;

    const pageTitle = opts.title ? `${opts.title} · hyper-code2` : "hyper-code2";
    // A tiny terminal prompt: dark enough to survive light browser chrome,
    // with a mint chevron and violet cursor that remain legible at 16×16.
    const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#252a34"/><path d="m8 9 7 7-7 7" fill="none" stroke="#6ee7b7" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 23H25" stroke="#a78bfa" stroke-width="3.2" stroke-linecap="round"/><circle cx="25" cy="7" r="2.3" fill="#fb7185"/></svg>`;
    const favicon = `data:image/svg+xml,${encodeURIComponent(faviconSvg)}`;
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(pageTitle)}</title>
<script src="/ui/vendor/tailwind.js"></script>
<link rel="icon" href="${favicon}" type="image/svg+xml">
<script src="/ui/vendor/htmx.js" defer></script>
<link rel="stylesheet" href="/ui/vendor/phosphor.css">
<style>
/* Compact lazy tool links. The tray is assembled client-side so consecutive
   calls occupy one visual row without wrapping each button in extra markup. */
.tool-tray { display: flex; flex-wrap: wrap; gap: .25rem; align-items: center; }
.tool.tool-tucked { width: 1.333rem; height: 1.333rem; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 9999px; }
.tool.tool-tucked > i { font-size: .7rem; }
.tool { transition: background-color .2s ease, border-color .15s ease, box-shadow .15s ease, transform .15s ease; }
.tool.tool-tucked:hover { background-color: rgb(249 250 251); border-color: rgb(107 114 128); box-shadow: 0 3px 8px rgb(17 24 39 / .18); transform: translateY(-2px) scale(1.15); color: rgb(55 65 81); }
.tool.tool-tucked:active { transform: translateY(0) scale(1.05); }
/* Highlighted code inside tool detail dialogs. */
.tool-dialog-body pre { margin: 0; padding: .75rem 1rem; border-radius: .65rem; background: rgba(0,0,0,.04) !important; white-space: pre-wrap; word-break: break-word; }
.tool-dialog-body pre + pre { margin-top: .75rem; }
.tool-dialog-body code { font-size: 12px; line-height: 1.5; }
.tool-dialog-body .edit-preview pre { border-radius: 0; background: transparent !important; }
.tool-dialog-body .edit-remove pre { background: transparent !important; }
.tool-dialog-body .edit-add pre { background: transparent !important; }
</style>

<style>
  body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
  .shiki { background: transparent !important; }
  .assistant pre.shiki { padding: .6em .8em; border-radius: 6px; overflow-x: auto; margin: .4em 0; font-size: 12.5px; line-height: 1.45; }
  .tool pre.shiki { padding: 0; margin: 0; overflow-x: auto; }
</style>
${((ctx.state as any).procs?.styles ?? []).map((st: any) => `<link rel="stylesheet" href="${esc(st.href)}">`).join("\n")}
${opts.headExtra ?? ""}
<script src="/ui/control.js" defer></script>
<script src="/procs/events/client.js" defer></script>
<script src="/ui/hotkeys.js" defer></script>
<script src="/ui/rail.js" defer></script>
<script src="/agent/chat.js" defer></script>
<script src="/screen/client.js" defer></script>
</head>
<body class="bg-gray-100 text-gray-900 text-sm h-screen"${currentId ? ` data-agent-id="${esc(currentId)}"` : ""}>
<div id="frame" class="relative flex h-screen">
  <!-- The rail loads itself (and keeps itself fresh) — layout never awaits the agent list. -->
  ${ctx.fns.ui.live({
      id: "agents-rail",
      url: `/ui/rail${currentId ? `?current=${encodeURIComponent(currentId)}` : ""}`,
      topic: "agents",
      tag: "nav",
      swap: "innerHTML",
      trigger: "load, rail-refresh",
      every: 60,
      attrs: `class="shrink-0 w-60 border-r border-gray-300 bg-gray-100 flex flex-col" ${ctx.fns.procs.ui.attr({ section: "agents" })}`,
  })}
  <!-- Everything that belongs to ONE agent lives here: switching agents swaps
       this container and leaves the rail alone, so the list keeps its scroll,
       its open groups and its focus while the conversation is replaced. -->
  <div id="agent-view" class="flex min-w-0 flex-1">
  <aside id="chat-panel" class="border-r border-gray-300 flex flex-col bg-gray-50 relative transition-[width,flex] duration-200 ${rightPanelCollapsed ? "min-w-0 flex-1" : "shrink-0"}" style="${rightPanelCollapsed ? "" : `width:${chatWidth}`}" data-agent-id="${esc(currentId ?? "")}">
    <div id="chat-resize" class="${rightPanelCollapsed ? "hidden" : ""}" style="position:absolute;top:0;bottom:0;right:0;z-index:10;width:9px;transform:translateX(50%);cursor:col-resize" title="drag to resize"></div>
    ${chat}
  </aside>
  <!-- The whole right side navigates into #main (workspace pattern): links and
       forms inside pages swap the page pane only, so the chat column and its
       long-poll are never redrawn. hx-history-elt scopes back/forward refetch
       to #main too. Anything that must re-render the chat (switching agents,
       creating/deleting one) opts out with hx-boost="false". -->
  <section id="workspace-panel" class="shrink-0 flex flex-col border-l border-gray-300 bg-gray-100 transition-[width] duration-200 ${rightPanelCollapsed ? "w-9" : "min-w-0 flex-1"}" hx-boost="true" hx-target="#main" hx-swap="innerHTML" hx-push-url="true" aria-hidden="${rightPanelCollapsed ? "true" : "false"}">
    <div class="flex h-10 shrink-0 items-center border-b border-gray-300 bg-gray-100 ${rightPanelCollapsed ? "justify-center px-0" : "min-w-0"}">
      ${rightPanelCollapsed ? "" : `<div class="min-w-0 flex-1">${ctx.fns.ui.topbar({ path, agentId: currentId })}</div>`}
      <button id="workspace-toggle" type="button" title="${rightPanelCollapsed ? "Show workspace" : "Hide workspace"}" aria-label="${rightPanelCollapsed ? "Show workspace" : "Hide workspace"}" aria-expanded="${rightPanelCollapsed ? "false" : "true"}" class="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-white hover:text-gray-700"><i class="ph ${rightPanelCollapsed ? "ph-caret-left" : "ph-caret-right"}"></i></button>
    </div>
    <main id="main" hx-history-elt class="min-w-0 min-h-0 bg-white ${rightPanelCollapsed ? "hidden" : "flex flex-1 flex-col overflow-y-auto"}">${opts.main}</main>
  </section>
  </div>
</div>
<div id="modal"></div>
${ctx.fns.ui.navMenu({})}
<script>
(function () {
  // Chat column resize. The server-rendered width comes from Postgres kv;
  // mouse-up persists the new preference there for every tab and restart.
  const grip = document.getElementById("chat-resize");
  const chatPanel = document.getElementById("chat-panel");
  if (grip && chatPanel) grip.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const move = (ev) => {
      const width = Math.min(Math.max(ev.clientX - document.getElementById("agents-rail").getBoundingClientRect().right, 280), window.innerWidth * 0.7);
      chatPanel.style.width = width + "px";
    };
    const up = async () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      const width = Math.round(chatPanel.getBoundingClientRect().width);
      try { await fetch("/ui/chat-width", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ width }) }); } catch {}
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  });

  // Workspace pane collapse is persisted in server-side kv, so it follows the
  // workspace across reloads/browser tabs and survives a server restart.
  const workspace = document.getElementById("workspace-panel");
  const workspaceToggle = document.getElementById("workspace-toggle");
  if (workspace && workspaceToggle) workspaceToggle.addEventListener("click", async () => {
    const collapsed = workspace.getAttribute("aria-hidden") !== "true";
    workspaceToggle.setAttribute("disabled", "true");
    try {
      await fetch("/ui/right-panel", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ collapsed }) });
      location.reload();
    } catch {
      workspaceToggle.removeAttribute("disabled");
    }
  });

})();
</script>
</body>
</html>`;
}
