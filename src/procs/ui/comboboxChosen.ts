// The collapsed state a combobox swaps to after a pick: the chosen label, a
// hidden input carrying the value for the surrounding form, and a "change" control
// that reopens the search (htmx swaps the widget back to `ui.combobox` via
// `?reopen`). The results endpoint returns this for `?pick=<value>`.
/**
 * Perform combobox chosen for the ui subsystem.
 * @param opts.name The target name.
 * @param opts.url The target URL.
 * @param opts.value The value to apply.
 * @param opts.label The display label.
 */
export default function (ctx: Context, _session: Session | null, opts: { name: string; url: string; value: string; label: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const change = ctx.fns.procs.ui.button({
        action: "change", label: "change", get: `${opts.url}?reopen&name=${encodeURIComponent(opts.name)}`,
        target: "closest [data-field]", swap: "outerHTML", appearance: "plain",
        class: "ui-focusable shrink-0 rounded text-xs text-primary hover:underline",
    });
    return `<div class="relative" ${ctx.fns.procs.ui.attr({ field: opts.name })}>
  <div class="flex items-center justify-between gap-2 rounded-md border border-base-300 bg-base-100 px-3 py-1.5">
    <span class="text-sm text-base-content" ${ctx.fns.procs.ui.attr({ role: "value" })}>${esc(opts.label)}</span>
    <input type="hidden" name="${esc(opts.name)}" value="${esc(opts.value)}">
    ${change}
  </div>
</div>`;
}
