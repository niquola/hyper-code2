// GET /nav/items?q=… — the ⌘K palette's row list (htmx fragment).
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const q = new URL(opts.req.url).searchParams.get("q") ?? "";
    const items = await ctx.fns.nav.items({ q });
    const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const rows = items.map((i) => `
<a href="${esc(i.href)}" class="nav-row flex items-baseline gap-3 px-5 py-2 text-sm hover:bg-gray-50 border-b border-gray-100">
  <span class="truncate">${esc(i.label)}</span>
  ${i.hint ? `<span class="ml-auto shrink-0 text-[11px] text-gray-400">${esc(i.hint)}</span>` : ""}
</a>`).join("");
    return new Response(rows || `<div class="px-5 py-3 text-sm text-gray-400">nothing</div>`, {
        headers: { "content-type": "text/html; charset=utf-8" },
    });
}
