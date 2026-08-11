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
    if (opts.currentId) (ctx.state as any).uiCurrentAgent = opts.currentId;
    let currentId = opts.currentId ?? (ctx.state as any).uiCurrentAgent;
    if (!currentId) {
        try { currentId = (await ctx.fns.session.list({}))[0]?.id; } catch { /* no db in bare test ctxs */ }
    }

    const chat = currentId
        ? await ctx.fns.ui.chatColumn({ agentId: currentId })
        : `<div class="flex-1 flex items-center justify-center text-gray-400 text-sm">
             <a href="/agent/new" class="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100">+ new agent</a>
           </div>`;

    const pageTitle = opts.title ? `${opts.title} · hyper-code2` : "hyper-code2";
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(pageTitle)}</title>
<script src="https://cdn.tailwindcss.com?plugins=typography"></script>
<script src="https://unpkg.com/htmx.org@2.0.4" defer></script>
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
<style>
/* A tucked tool card: icon only, sitting in a row with its neighbours. The
   width transition is what makes it read as "moving aside" rather than as the
   page reflowing under you. */
.tool-tray { display: flex; flex-wrap: wrap; gap: .25rem; align-items: center; }
.tool.tool-tucked { width: 2rem; height: 2rem; border-radius: 9999px; overflow: hidden; }
.tool.tool-tucked > summary { padding: 0; height: 100%; justify-content: center; }
.tool.tool-tucked .tool-label,
.tool.tool-tucked .tool-subject,
.tool.tool-tucked .tool-size,
.tool.tool-tucked .tool-status,
.tool.tool-tucked .tool-caret { display: none; }
.tool.tool-tucked > *:not(summary) { display: none; }
.tool { transition: width .2s ease, background-color .2s ease; }
.tool.tool-tucked:hover { background-color: rgb(249 250 251); }
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
<script src="/screen/client.js" defer></script>
</head>
<body class="bg-gray-100 text-gray-900 text-sm h-screen"${currentId ? ` data-agent-id="${esc(currentId)}"` : ""}>
<div class="flex h-screen">
  <aside id="chat-panel" class="shrink-0 border-r border-gray-300 flex flex-col bg-gray-50 relative" style="width:var(--chat-w,26rem)">
    <div id="chat-resize" style="position:absolute;top:0;bottom:0;right:0;z-index:10;width:9px;transform:translateX(50%);cursor:col-resize" title="drag to resize"></div>
    ${chat}
  </aside>
  <!-- The whole right side navigates into #main (workspace pattern): links and
       forms inside pages swap the page pane only, so the chat column and its
       long-poll are never redrawn. hx-history-elt scopes back/forward refetch
       to #main too. Anything that must re-render the chat (switching agents,
       creating/deleting one) opts out with hx-boost="false". -->
  <section class="flex-1 min-w-0 flex flex-col" hx-boost="true" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">
    ${ctx.fns.ui.topbar({ path })}
    <main id="main" hx-history-elt class="flex-1 min-w-0 min-h-0 overflow-y-auto flex flex-col bg-white">${opts.main}</main>
  </section>
</div>
${ctx.fns.ui.navMenu({})}
<script>
(function () {
  // Chat column resize, persisted.
  const saved = localStorage.getItem("chat-w");
  if (saved) document.documentElement.style.setProperty("--chat-w", saved);
  const grip = document.getElementById("chat-resize");
  if (grip) grip.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const move = (ev) => {
      const w = Math.min(Math.max(ev.clientX, 280), window.innerWidth * 0.7) + "px";
      document.documentElement.style.setProperty("--chat-w", w);
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      localStorage.setItem("chat-w", getComputedStyle(document.documentElement).getPropertyValue("--chat-w"));
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  });
})();
</script>
</body>
</html>`;
}
