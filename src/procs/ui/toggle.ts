// A switch — on or off, applied at once. It carries the verb (`data-action`) and
// the field name (`data-field`); `post`/`get` wire the flip to htmx, the hidden
// input carries the value a form reads.
/**
 * Perform toggle for the ui subsystem.
 * @param opts.action The action URL.
 * @param opts.name The target name.
 * @param opts.on The on value used by the operation.
 * @param opts.label The display label.
 * @param opts.post The post value used by the operation.
 * @param opts.get The get value used by the operation.
 * @param opts.vals The vals value used by the operation.
 */
export default function (ctx: Context, _session: Session | null, opts: {action: string; name?: string; on?: boolean; label?: string; post?: string; get?: string; vals?: Record<string, any> }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const hx = opts.post ? `hx-post="${esc(opts.post)}"` : opts.get ? `hx-get="${esc(opts.get)}"` : "";
    const vals = opts.vals ? ` hx-vals="${esc(JSON.stringify(opts.vals))}"` : "";
    // the shared component layer's `toggle` is a checkbox it styles itself, so the switch is the
    // input rather than a button wrapping one — the flip still goes through htmx.
    return `<label class="label cursor-pointer justify-start gap-2" ${ctx.fns.procs.ui.attr({ field: opts.name })}>
  ${opts.name ? `<input type="hidden" name="${esc(opts.name)}" value="${opts.on ? "true" : "false"}">` : ""}
  <input type="checkbox" class="toggle toggle-sm toggle-primary" role="switch" ${opts.on ? "checked" : ""}
    aria-label="${esc(opts.label ?? opts.name ?? opts.action)}"
    ${ctx.fns.procs.ui.attr({ action: opts.action })} ${hx}${vals} hx-target="#main" hx-swap="innerHTML">
  ${opts.label ? `<span class="label-text text-sm">${esc(opts.label)}</span>` : ""}
</label>`;
}
