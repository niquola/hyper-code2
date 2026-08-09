// The rows a combobox's results endpoint returns for `?q=<typed>`: one option per
// item, or a "no matches" line. Two shapes, chosen per item:
//   • no `href` → a pick button that htmx-swaps the whole widget (`closest
//     [data-field]`) for the chosen state (`?pick=`) — a form field.
//   • `href` set → a link that navigates `#main` to it (same swap as a list row),
//     for a type-ahead that jumps somewhere (e.g. a patient).
// Either way the row is a `[role=option]` the kit's `$script_combobox` drives with
// arrow-keys/Enter. An app endpoint filters its own data and hands the hits here,
// so the markup stays one shape across every combobox.
export default function (ctx: Context, _session: Session | null, opts: { name: string; url: string; items: Array<{ value: string; label: string; hint?: string; href?: string }> }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    if (!opts.items.length) return `<div class="px-3 py-2 text-xs text-base-content/60">no matches</div>`;
    const cls = "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-base-content hover:bg-base-200";
    return opts.items.map(o => {
        const inside = `<span class="min-w-0 truncate">${esc(o.label)}</span>${o.hint ? `<span class="ml-2 shrink-0 text-xs text-base-content/60">${esc(o.hint)}</span>` : ""}`;
        const marks = ctx.fns.procs.ui.attr({ action: "pick", id: o.value });
        return o.href
            ? `<a class="ui-focusable ${cls}" href="${esc(o.href)}" hx-get="${esc(o.href)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true" ${marks} role="option">${inside}</a>`
            : `<button type="button" class="${cls}" hx-get="${esc(opts.url)}?pick=${encodeURIComponent(o.value)}&name=${encodeURIComponent(opts.name)}" hx-target="closest [data-field]" hx-swap="outerHTML" ${marks} role="option">${inside}</button>`;
    }).join("");
}
