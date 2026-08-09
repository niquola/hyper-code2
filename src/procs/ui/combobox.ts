// A search-as-you-type select — a patient, a code from a value set. The input
// asks the server for matches (htmx) and drops them into a list below; arrow-keys
// and Enter are added by `$script_combobox.js`, picking one is a link/button the
// results endpoint renders. The endpoint at `url` receives `?name=<field>&q=<typed>`
// and returns option rows (via ui.comboboxResults) — the search box is named `q`
// so the typed value arrives as `q`, while the chosen value carries `name`.
export default function (ctx: Context, _session: Session | null, opts: {name: string; url: string; value?: string; placeholder?: string; class?: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const results = `cb-${opts.name.replace(/[^a-zA-Z0-9]/g, "")}`;
    const url = `${opts.url}${opts.url.includes("?") ? "&" : "?"}name=${encodeURIComponent(opts.name)}`;
    return `<div class="relative ${opts.class ?? ""}" ${ctx.fns.procs.ui.attr({ field: opts.name })}>
  <input name="q" value="${esc(opts.value ?? "")}" placeholder="${esc(opts.placeholder ?? "Search…")}" autocomplete="off"
    class="input input-sm w-full"
    hx-get="${esc(url)}" hx-trigger="input changed delay:200ms, focus" hx-target="#${results}" hx-swap="innerHTML"
    role="combobox" aria-label="${esc(opts.name)}" aria-autocomplete="list" aria-controls="${results}" aria-expanded="false">
  <div id="${results}" class="ui-combobox__results menu border-base-300 bg-base-100 rounded-box absolute z-50 mt-1 hidden w-full overflow-hidden border p-0 shadow-lg" role="listbox"></div>
</div>`;
}
