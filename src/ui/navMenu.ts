// ui.navMenu — the global ⌘K palette as one self-contained island (uniskill's
// navMenu, re-done in plain JS + htmx — no datastar here). The layout drops it
// at the end of <body>; rows come from GET /nav/items?q=… (htmx swap).
export default function (_ctx: Context, _session: Session | null, _opts?: {}): string {
    return `<div id="nav-overlay" class="hidden fixed inset-0 z-50 bg-black/30" onclick="if(event.target===this)window.__navClose()">
  <div class="mx-auto mt-[10vh] max-w-xl flex flex-col bg-white rounded-xl shadow-2xl border border-gray-300 overflow-hidden">
    <input id="nav-q" name="q" placeholder="Go to… (agents, pages)" autocomplete="off"
           hx-get="/nav/items" hx-trigger="input changed delay:100ms, focus once" hx-target="#nav-results"
           class="w-full px-5 py-3 text-base outline-none border-b border-gray-200">
    <div id="nav-results" class="max-h-[50vh] overflow-y-auto"></div>
    <div class="px-5 py-1.5 border-t border-gray-200 bg-gray-50 text-[11px] text-gray-500 flex gap-3">
      <span>↑↓ move</span><span>↵ open</span><span>esc close</span><span class="ml-auto">⌘K anywhere</span>
    </div>
  </div>
</div>
<script>
(function () {
  let sel = 0;
  const overlay = () => document.getElementById("nav-overlay");
  const rows = () => document.querySelectorAll("#nav-results .nav-row");
  const mark = () => rows().forEach((r, i) => r.classList.toggle("bg-blue-50", i === sel));
  window.__navOpen = function () {
    sel = 0;
    overlay().classList.remove("hidden");
    setTimeout(() => { const q = document.getElementById("nav-q"); q.focus(); q.select(); }, 30);
  };
  window.__navClose = function () { overlay().classList.add("hidden"); };
  document.body.addEventListener("htmx:afterSwap", (e) => {
    if (e.detail?.target?.id === "nav-results") { sel = 0; mark(); }
  });
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); window.__navOpen(); return; }
    if (overlay().classList.contains("hidden")) return;
    if (e.key === "Escape") { window.__navClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, rows().length - 1); mark(); }
    if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); }
    if (e.key === "Enter") { const r = rows()[sel]; if (r) location.href = r.getAttribute("href"); }
  });
})();
</script>`;
}
