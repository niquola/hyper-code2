// A sub-navigation — a list of links inside a page (the catalog's groups, a
// settings menu). Vertical by default; each item is htmx so it swaps the pane.
export default function (ctx: Context, _session: Session | null, opts: {items: Array<{ label: string; href: string; id?: string; icon?: string }>; current?: string; direction?: "col" | "row"; class?: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const wrap = opts.direction === "row" ? "flex items-center gap-1" : "space-y-0.5";
    return `<nav class="${wrap} ${opts.class ?? ""}" ${ctx.fns.procs.ui.attr({ role: "subnav" })}>
  ${opts.items.map(it => {
        const active = it.id === opts.current || opts.current === it.href;
        return `<a class="ui-focusable block rounded-md px-2.5 py-1.5 text-sm ${active ? "bg-primary/10 font-medium text-base-content" : "text-base-content/70 hover:bg-base-200 hover:text-base-content"}"
    ${ctx.fns.procs.ui.attr({ entity: "nav", id: it.id ?? it.label, status: active ? "active" : "" })} aria-current="${active ? "page" : "false"}"
    href="${esc(it.href)}" hx-get="${esc(it.href)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">${it.icon ? `<i class="ph ${esc(it.icon)} mr-2 text-base-content/60" aria-hidden="true"></i>` : ""}${esc(it.label)}</a>`;
    }).join("")}
</nav>`;
}
