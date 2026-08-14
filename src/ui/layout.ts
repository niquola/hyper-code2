// The app shell: a persistent agents rail on the left and one ordinary page on
// the right. Agent chat is a page like /llms, /files or /settings; the layout
// does not own an active agent or keep a hidden chat alive behind other pages.
//
// There is no menu bar. Navigation is the ⌘K palette (ui.navMenu over
// nav.items), reachable from the button in the rail's header — so a mounted
// module needs nothing but its routes to become reachable.
export default async function (ctx: Context, session: Session | null, opts: { currentId?: string; title?: string; main: string; headExtra?: string }): Promise<string> {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });

    // currentId is presentation-only: it highlights the matching rail row on
    // an agent page. It does not make that agent part of unrelated pages.
    const currentId = opts.currentId ?? session?.req?.headers?.get("x-hyper-agent") ?? undefined;
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
<script src="/ui/meta.js" defer></script>
<script src="/screen/client.js" defer></script>
</head>
<body class="bg-gray-100 text-gray-900 text-sm h-screen"${currentId ? ` data-agent-id="${esc(currentId)}"` : ""}>
<div id="frame" class="relative flex h-screen">
  ${ctx.fns.ui.live({
      id: "agents-rail",
      url: `/ui/rail${currentId ? `?current=${encodeURIComponent(currentId)}` : ""}`,
      topic: "agents",
      tag: "nav",
      swap: "innerHTML",
      trigger: "load, rail-refresh",
      every: 60,
      attrs: `class="shrink-0 w-64 border-r border-gray-200 bg-gray-50 flex flex-col" ${ctx.fns.procs.ui.attr({ section: "agents" })}`,
  })}
  <!-- No htmx attributes on this container. htmx inherits hx-target, hx-swap
       and hx-push-url into EVERY descendant, and #main holds live content (the
       chat's tail poll, the status bar, the meta panel). With navigation
       declared here, each of those answered its own poll by replacing the page
       and pushing its fragment URL into the address bar. Navigation belongs to
       the things that navigate — the tab strip and the rail's links. -->
  <section id="page-view" class="flex min-w-0 flex-1 flex-col bg-white">
    <main id="main" hx-history-elt class="min-h-0 min-w-0 flex flex-1 flex-col overflow-y-auto">${opts.main}</main>
  </section>
</div>
<div id="modal"></div>
${ctx.fns.ui.navMenu({})}
<dialog id="tool-dialog" class="m-auto max-h-[82vh] w-[min(48rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl backdrop:bg-gray-950/40 backdrop:backdrop-blur-[1px]">
  <div class="flex max-h-[82vh] flex-col">
    <div class="flex shrink-0 items-center gap-3 border-b border-gray-200 px-5 py-3.5"><h2 id="tool-dialog-title" class="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-gray-800">tool</h2><form method="dialog"><button title="Close" aria-label="Close" class="flex size-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"><i class="ph ph-x text-lg"></i></button></form></div>
    <div id="tool-dialog-body" class="tool-dialog-body min-h-0 flex-1 overflow-auto bg-gray-50/60 p-5 text-xs text-gray-700"></div>
  </div>
</dialog>

</body>
</html>`;
}
