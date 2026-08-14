// A button group — a segmented control for one choice among a few: a filter
// toolbar, a view switch. Each item is a link (the selection lives in the URL)
// or, given a `name`, a set of buttons the form posts. The chosen one is raised.
/**
 * Perform segmented for the ui subsystem.
 * @param opts.items The items value used by the operation.
 * @param opts.value The value to apply.
 * @param opts.name The target name.
 */
export default function (ctx: Context, _session: Session | null, opts: {items: Array<{ label: string; value: string; href?: string }>; value?: string; name?: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    // daisyUI's `join` is the button group: it squares the inner corners itself,
    // so a segment is a plain `btn` and the chosen one is `btn-active`.
    const seg = (it: { label: string; value: string; href?: string }) => {
        const on = it.value === opts.value;
        const cls = `join-item btn btn-sm ${on ? "btn-active btn-primary" : ""}`;
        if (it.href) return `<a class="${cls}" aria-current="${on ? "true" : "false"}" ${ctx.fns.procs.ui.attr({ role: "segment", status: on ? "active" : "" })} href="${esc(it.href)}" hx-get="${esc(it.href)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">${esc(it.label)}</a>`;
        return `<button type="button" class="${cls}" ${ctx.fns.procs.ui.attr({ action: "select", id: it.value, status: on ? "active" : "" })}>${esc(it.label)}</button>`;
    };
    return `<div class="join" role="group" aria-label="options" ${ctx.fns.procs.ui.attr({ field: opts.name })}>${opts.items.map(seg).join("")}</div>`;
}
