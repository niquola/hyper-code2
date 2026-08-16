// Page through a long list. `href(page)` builds the link for each page, so the
// page you are on is in the URL and shareable; prev/next disable at the ends.
/**
 * Perform pagination for the ui subsystem.
 * @param opts.page Current one-based page number.
 * @param opts.pages Total number of available pages.
 * @param opts.href Builds the navigation URL for a page number.
 */
export default function (ctx: Context, _session: Session | null, opts: {page: number; pages: number; href: (page: number) => string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    if (opts.pages <= 1) return "";
    const link = (p: number, label: string, on = false, disabled = false) => ctx.fns.procs.ui.button({
        label, href: disabled ? undefined : opts.href(p), disabled,
        tone: on ? "primary" : "default", active: on, size: "sm", class: "join-item",
        attrs: disabled ? undefined : { "hx-push-url": "true" },
    });
    const nums: string[] = [];
    for (let p = 1; p <= opts.pages; p++) nums.push(link(p, String(p), p === opts.page));
    return `<nav class="join" ${ctx.fns.procs.ui.attr({ role: "pagination" })}>
  ${link(opts.page - 1, "‹ Prev", false, opts.page <= 1)}${nums.join("")}${link(opts.page + 1, "Next ›", false, opts.page >= opts.pages)}
</nav>`;
}
