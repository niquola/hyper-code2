// A button group — a segmented control for one choice among a few: a filter
// toolbar, a view switch. Each item is a link (the selection lives in the URL)
// or, given a `name`, a set of buttons the form posts. The chosen one is raised.
/**
 * Perform segmented for the ui subsystem.
 * @param opts.items Selectable segments, each with a label, submitted value, and optional navigation URL.
 * @param opts.value The value to apply.
 * @param opts.name The target name.
 */
export default function (ctx: Context, _session: Session | null, opts: {items: Array<{ label: string; value: string; href?: string }>; value?: string; name?: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const seg = (it: { label: string; value: string; href?: string }) => {
        const on = it.value === opts.value;
        return ctx.fns.procs.ui.button({
            action: it.href ? undefined : "select", label: it.label, href: it.href,
            id: it.href ? undefined : it.value, uiRole: "segment", status: on ? "active" : "",
            tone: on ? "primary" : "default", active: on, size: "sm", class: "join-item",
            attrs: it.href ? { "aria-current": on ? "true" : "false", "hx-push-url": "true" } : undefined,
        });
    };
    return `<div class="join" role="group" aria-label="options" ${ctx.fns.procs.ui.attr({ field: opts.name })}>${opts.items.map(seg).join("")}</div>`;
}
