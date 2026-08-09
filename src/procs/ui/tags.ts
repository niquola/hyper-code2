// A row of chips — labels, selected filters, a multi-value answer shown back.
// Each can carry a remove button that posts (htmx) to drop it.
const TONE = {
    neutral: "badge-neutral", info: "badge-info", success: "badge-success",
    warning: "badge-warning", danger: "badge-error",
} as const;

export default function (ctx: Context, _session: Session | null, opts: {items: Array<{ label: string; value?: string; removeUrl?: string; tone?: keyof typeof TONE }>; class?: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    return `<div class="flex flex-wrap gap-1.5 ${opts.class ?? ""}" ${ctx.fns.procs.ui.attr({ role: "tags" })}>
  ${opts.items.map(t => {
        return `<span class="badge badge-soft badge-sm ${TONE[t.tone ?? "neutral"]} gap-1" ${ctx.fns.procs.ui.attr({ entity: "tag", id: t.value ?? t.label })}>${esc(t.label)}${t.removeUrl ? `<button type="button" class="hover:text-error -mr-0.5 cursor-pointer" ${ctx.fns.procs.ui.attr({ action: "remove" })} hx-post="${esc(t.removeUrl)}" hx-target="#main" hx-swap="innerHTML" aria-label="Remove ${esc(t.label)}"><i class="ph ph-x text-xs" aria-hidden="true"></i></button>` : ""}</span>`;
    }).join("")}
</div>`;
}
