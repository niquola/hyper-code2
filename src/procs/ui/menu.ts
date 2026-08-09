// A dropdown of actions — a row's kebab, a "more" button. A <details> disclosure
// with an absolutely-positioned panel: no client JS, and it closes on its own
// because every item navigates or posts (the pane re-renders, the menu is gone).
// Each item is an action (data-action), a link, or an htmx post.
export default function (ctx: Context, _session: Session | null, opts: {id?: string; label?: string; icon?: string; items: Array<{ label: string; icon?: string; href?: string; action?: string; post?: string; get?: string; vals?: Record<string, any>; danger?: boolean }>; align?: "left" | "right"; class?: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    // daisyUI's `dropdown` on a <details>, with `menu` inside it — the panel,
    // the hover states and the item padding are the component's.
    const item = (it: (typeof opts.items)[number]) => {
        const cls = it.danger ? "text-error" : "";
        const icon = it.icon ? `<i class="ph ${esc(it.icon)} w-4 opacity-60" aria-hidden="true"></i>` : "";
        const hx = it.post ? `hx-post="${esc(it.post)}"` : it.get ? `hx-get="${esc(it.get)}"` : "";
        const vals = it.vals ? ` hx-vals="${esc(JSON.stringify(it.vals))}"` : "";
        const inner = it.href
            ? `<a class="${cls}" href="${esc(it.href)}" hx-get="${esc(it.href)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true" role="menuitem">${icon}${esc(it.label)}</a>`
            : `<button type="button" class="${cls}" ${ctx.fns.procs.ui.attr({ action: it.action })} ${hx}${vals} hx-target="#main" hx-swap="innerHTML" role="menuitem">${icon}${esc(it.label)}</button>`;
        return `<li>${inner}</li>`;
    };
    const trigger = opts.label || opts.icon
        ? `${opts.icon ? `<i class="ph ${esc(opts.icon)}" aria-hidden="true"></i>` : ""}${opts.label ? `<span>${esc(opts.label)}</span>` : ""}`
        : `<i class="ph ph-dots-three" aria-hidden="true"></i>`;
    return `<details class="dropdown ${opts.align === "left" ? "" : "dropdown-end"} ${opts.class ?? ""}" ${ctx.fns.procs.ui.attr({ entity: "menu", id: opts.id })}>
  <summary class="btn btn-xs btn-ghost" ${ctx.fns.procs.ui.attr({ action: "menu" })} aria-haspopup="menu">${trigger}</summary>
  <ul class="menu dropdown-content bg-base-100 rounded-box z-50 mt-1 w-52 p-2 shadow-lg" role="menu">${opts.items.map(item).join("")}</ul>
</details>`;
}
