// Page through a long list. `href(page)` builds the link for each page, so the
// page you are on is in the URL and shareable; prev/next disable at the ends.
export default function (ctx: Context, _session: Session | null, opts: {page: number; pages: number; href: (page: number) => string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    if (opts.pages <= 1) return "";
    // daisyUI pages a list with `join` — the buttons sit flush as one control.
    const link = (p: number, label: string, on = false, disabled = false) => disabled
        ? `<button class="join-item btn btn-sm" disabled>${esc(label)}</button>`
        : `<a class="join-item btn btn-sm ${on ? "btn-active btn-primary" : ""}" href="${esc(opts.href(p))}" hx-get="${esc(opts.href(p))}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">${esc(label)}</a>`;
    const nums: string[] = [];
    for (let p = 1; p <= opts.pages; p++) nums.push(link(p, String(p), p === opts.page));
    return `<nav class="join" ${ctx.fns.procs.ui.attr({ role: "pagination" })}>
  ${link(opts.page - 1, "‹ Prev", false, opts.page <= 1)}${nums.join("")}${link(opts.page + 1, "Next ›", false, opts.page >= opts.pages)}
</nav>`;
}
