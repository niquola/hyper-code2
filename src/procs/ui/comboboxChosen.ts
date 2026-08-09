// The collapsed state a combobox swaps to after a pick: the chosen label, a
// hidden input carrying the value for the surrounding form, and a "change" control
// that reopens the search (htmx swaps the widget back to `ui.combobox` via
// `?reopen`). The results endpoint returns this for `?pick=<value>`.
export default function (ctx: Context, _session: Session | null, opts: { name: string; url: string; value: string; label: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    return `<div class="relative" ${ctx.fns.procs.ui.attr({ field: opts.name })}>
  <div class="flex items-center justify-between gap-2 rounded-md border border-base-300 bg-base-100 px-3 py-1.5">
    <span class="text-sm text-base-content" ${ctx.fns.procs.ui.attr({ role: "value" })}>${esc(opts.label)}</span>
    <input type="hidden" name="${esc(opts.name)}" value="${esc(opts.value)}">
    <button type="button" class="ui-focusable shrink-0 rounded text-xs text-primary hover:underline"
      hx-get="${esc(opts.url)}?reopen&name=${encodeURIComponent(opts.name)}" hx-target="closest [data-field]" hx-swap="outerHTML"
      ${ctx.fns.procs.ui.attr({ action: "change" })}>change</button>
  </div>
</div>`;
}
