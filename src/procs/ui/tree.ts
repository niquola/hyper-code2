// A nested tree — a file listing, a resource structure. Folders are <details>
// (open/close with no JS), leaves are links. `open` expands a branch.
type Node = { label: string; icon?: string; href?: string; children?: Node[]; open?: boolean; id?: string };
export default function (ctx: Context, _session: Session | null, opts: {nodes: Node[]; class?: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    return `<ul class="text-sm ${opts.class ?? ""}" ${ctx.fns.procs.ui.attr({ role: "tree" })}>${opts.nodes.map(n => node(ctx, n)).join("")}</ul>`;
}
function node(ctx: Context, n: Node): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const icon = n.icon ? `<i class="ph ${esc(n.icon)} text-base-content/60" aria-hidden="true"></i>` : "";
    if (n.children) {
        return `<li ${ctx.fns.procs.ui.attr({ entity: "node", id: n.id ?? n.label })}><details${n.open ? " open" : ""}>
    <summary class="ui-focusable flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-base-200"><i class="ph ph-caret-right ui-tree__caret text-xs text-base-content/40" aria-hidden="true"></i>${icon}<span>${esc(n.label)}</span></summary>
    <ul class="ml-4 border-l border-base-300 pl-2">${n.children.map(c => node(ctx, c)).join("")}</ul>
  </details></li>`;
    }
    const inner = `${icon}<span class="truncate">${esc(n.label)}</span>`;
    return `<li ${ctx.fns.procs.ui.attr({ entity: "node", id: n.id ?? n.label })}>${n.href
        ? `<a class="ui-focusable flex items-center gap-1.5 rounded-md px-1.5 py-1 pl-5 text-base-content/70 hover:bg-base-200 hover:text-base-content" href="${esc(n.href)}" hx-get="${esc(n.href)}" hx-target="#main" hx-swap="innerHTML" hx-push-url="true">${inner}</a>`
        : `<span class="flex items-center gap-1.5 px-1.5 py-1 pl-5 text-base-content/70">${inner}</span>`}</li>`;
}
