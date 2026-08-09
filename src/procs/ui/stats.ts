// A row of stat tiles — the caseload at a glance above a list. Wraps to a grid
// on narrow panes so a half-window still reads.
export default function (ctx: Context, _session: Session | null, opts: { items: Array<{ label: string; value: string | number; sub?: string; tone?: "info" | "success" | "warning" | "danger" }>; class?: string }): string {
    return `<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 ${opts.class ?? ""}">${opts.items.map(item => ctx.fns.procs.ui.stat(item)).join("")}</div>`;
}
