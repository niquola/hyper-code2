// A native dropdown — one value from a set too long for radio cards (a code
// from a value set, a status). Styled to match ui.field, carries data-field so
// page.fill/page.state drive it, and fires a real `change` so a self-updating
// form (skip logic, live score) recomputes on pick. No client JS. An empty
// first option is "no answer" — so a required-but-untouched select still fails.
/**
 * Select the ui subsystem operation.
 * @param opts.name The target name.
 * @param opts.value The value to apply.
 * @param opts.options The options value used by the operation.
 * @param opts.placeholder The placeholder value used by the operation.
 * @param opts.class CSS classes to apply.
 * @param opts.ariaLabel The aria label value used by the operation.
 */
export default function (ctx: Context, _session: Session | null, opts: {
    name: string; value?: string; options: Array<{ value: string; label: string }>; placeholder?: string; class?: string; ariaLabel?: string;
}): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const chosen = opts.value != null && opts.value !== "";
    const placeholder = `<option value=""${chosen ? "" : " selected"}>${esc(opts.placeholder ?? "Select…")}</option>`;
    const option = (o: { value: string; label: string }) => `<option value="${esc(o.value)}"${o.value === opts.value ? " selected" : ""}>${esc(o.label)}</option>`;
    return `<select name="${esc(opts.name)}" aria-label="${esc(opts.ariaLabel ?? opts.name)}"
  class="select select-sm ${opts.class ?? "w-full"}"
  ${ctx.fns.procs.ui.attr({ field: opts.name })}>${placeholder}${opts.options.map(option).join("")}</select>`;
}
