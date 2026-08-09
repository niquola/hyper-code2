// One choice from a few. `layout: "cards"` is the Tailwind-UI radio-card grid —
// full-width, tappable, the chosen one ringed in brand — which is what a
// questionnaire's answer options want; `"list"` is the plain stacked radios.
// Every radio shares `name` and the group carries `data-field` for page.fill.
export default function (ctx: Context, _session: Session | null, opts: {
    name: string; value?: string; options: Array<{ value: string; label: string }>; layout?: "list" | "cards"; class?: string;
}): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    if (opts.layout === "cards") {
        // Selected look is CSS :has(input:checked) — not a server class bake — so
        // a click highlights immediately without a round-trip.
        const card = (o: { value: string; label: string }) => {
            const on = o.value === opts.value;
            return `<label class="ui-radio-card border-base-300 bg-base-100 hover:border-primary hover:bg-base-200 relative flex cursor-pointer items-center justify-center rounded-md border px-3 py-2.5 text-center text-sm">
    <input type="radio" name="${esc(opts.name)}" value="${esc(o.value)}"${on ? " checked" : ""} class="sr-only"><span>${esc(o.label)}</span></label>`;
        };
        return `<div class="grid grid-cols-2 gap-2 sm:grid-cols-4 ${opts.class ?? ""}" ${ctx.fns.procs.ui.attr({ field: opts.name })}>${opts.options.map(card).join("")}</div>`;
    }
    const row = (o: { value: string; label: string }) => {
        const on = o.value === opts.value;
        return `<label class="flex cursor-pointer items-center gap-3 text-sm">
    <input type="radio" name="${esc(opts.name)}" value="${esc(o.value)}"${on ? " checked" : ""} class="radio radio-sm radio-primary">${esc(o.label)}</label>`;
    };
    return `<div class="space-y-2 ${opts.class ?? ""}" ${ctx.fns.procs.ui.attr({ field: opts.name })}>${opts.options.map(row).join("")}</div>`;
}
