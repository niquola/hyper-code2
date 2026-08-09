// GET /search?q=…&agent=… — BM25 search over all transcripts.
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const url = new URL(opts.req.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    const agentId = url.searchParams.get("agent") ?? undefined;
    const hits = q ? await ctx.fns.session.searchBm25({ q, agentId, limit: 30 }) : [];

    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // paradedb.snippet highlights with <b>…</b> — escape everything, then let only those through.
    const snip = (s: string) => esc(s).replaceAll("&lt;b&gt;", '<b class="bg-yellow-100 font-semibold">').replaceAll("&lt;/b&gt;", "</b>");

    const rows = hits.map(h => `
      <a href="/agent/${encodeURIComponent(h.agentId)}" hx-boost="false" class="block rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50">
        <div class="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <span class="font-mono font-semibold text-gray-700">${esc(h.agentId)}</span>
          <span>#${h.idx}</span>
          <span>${esc(h.role)}</span>
          <span class="ml-auto">score ${h.score.toFixed(2)}</span>
        </div>
        <div class="text-sm text-gray-800 leading-snug">${snip(h.snippet)}</div>
      </a>`).join("\n");

    return {
        title: q ? `search: ${q}` : "search",
        main: `<div class="flex-1 overflow-y-auto p-6">
  <div class="max-w-3xl mx-auto">
    <form method="GET" action="/search" class="flex gap-2 mb-4">
      <input name="q" value="${esc(q)}" placeholder="BM25 search across all transcripts…" autofocus
             class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"/>
      ${agentId ? `<input type="hidden" name="agent" value="${esc(agentId)}"/>` : ""}
      <button class="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-700">search</button>
    </form>
    ${q && hits.length === 0 ? '<p class="text-sm text-gray-500">Nothing found.</p>' : ""}
    <div class="space-y-2">${rows}</div>
  </div>
</div>`,
    };
}
