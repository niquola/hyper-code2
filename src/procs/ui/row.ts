// One row of a box, and the reason the convention holds: a row is an entity, so
// it carries `entity`+`id` (and `status` when it has one) and every cell it is
// made of carries its `role`. Written this way a module cannot produce a row the
// workspace is unable to point at, and `page.state` reports the cells as the
// entity's fields without anyone thinking about it.
//
// `href` makes the row a link — page.open({entity,id}) follows it — and htmx
// swaps the pane rather than reloading the window.
export default function (ctx: Context, _session: Session | null, opts: {
    entity: string; id: string; status?: string; href?: string;
    cells: Array<{ role: string; text?: string; html?: string; class?: string; title?: string }>;
    right?: string;
}): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    // `title` is for a cell that truncates: a drug name is sixty characters and a
    // column is not, so the whole of it stays reachable by resting on it.
    const cells = opts.cells.map(c =>
        `<span class="${c.class ?? "min-w-0 flex-1 truncate"}"${c.title ? ` title="${esc(c.title)}"` : ""} ${ctx.fns.procs.ui.attr({ role: c.role })}>${c.html ?? esc(c.text)}</span>`).join("");
    const inside = `${cells}${opts.right ?? ""}`;
    const marks = ctx.fns.procs.ui.attr({ entity: opts.entity, id: opts.id, status: opts.status });
    const base = "flex items-center gap-3 border-t border-base-300 px-4 py-2.5";

    return opts.href
        ? `<a class="ui-focusable ${base} hover:bg-base-200" href="${esc(opts.href)}" hx-get="${esc(opts.href)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true" ${marks}>${inside}</a>`
        : `<div class="${base}" ${marks}>${inside}</div>`;
}
