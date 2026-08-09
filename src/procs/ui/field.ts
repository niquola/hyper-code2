// One input. The name is what `page.fill({ form, values })` uses, and it is also
// written as `data-field` so a control that is not a native input (a menu, a
// custom widget) can still be found by the same name.
export default function (ctx: Context, _session: Session | null, opts: {
    name: string; value?: string; placeholder?: string; type?: string;
    options?: Array<string | { value: string; label: string }>; class?: string; ariaLabel?: string;
    min?: number | string; max?: number | string; step?: number | string; maxlength?: number; pattern?: string;
}): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const marks = `${ctx.fns.procs.ui.attr({ field: opts.name })}${opts.ariaLabel ? ` aria-label="${esc(opts.ariaLabel)}"` : ""}`;
    const cls = opts.class ?? "flex-1";

    if (opts.options) {
        const options = opts.options.map(o => typeof o === "string" ? { value: o, label: o } : o);
        return `<select name="${esc(opts.name)}" ${marks} class="select select-sm ${cls}">
  ${options.map(o => `<option value="${esc(o.value)}"${o.value === opts.value ? " selected" : ""}>${esc(o.label)}</option>`).join("")}
</select>`;
    }
    // The native validation attributes — also read back by `collect` on the
    // server, so a bypassed browser can't skip them.
    const limits = [
        opts.min != null ? `min="${esc(opts.min)}"` : "", opts.max != null ? `max="${esc(opts.max)}"` : "",
        opts.step != null ? `step="${esc(opts.step)}"` : "", opts.maxlength != null ? `maxlength="${esc(opts.maxlength)}"` : "",
        opts.pattern ? `pattern="${esc(opts.pattern)}"` : "",
    ].filter(Boolean).join(" ");
    return `<input name="${esc(opts.name)}" ${marks} type="${esc(opts.type ?? "text")}" value="${esc(opts.value ?? "")}"
  placeholder="${esc(opts.placeholder ?? "")}"${limits ? " " + limits : ""} class="input input-sm ${cls}">`;
}
