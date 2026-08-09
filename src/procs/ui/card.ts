// A content card — softer than ui.box (no grey strip, a light shadow). A header
// with an optional action, the body, and an optional footer. For a dashboard
// tile or a self-contained panel that is not a list.
export default function (ctx: Context, _session: Session | null, opts: {title?: string; actions?: string; body: string; footer?: string; class?: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    return `<div class="card card-border bg-base-100 overflow-hidden ${opts.class ?? ""}">
  ${opts.title ? `<div class="border-base-300 flex items-center justify-between gap-3 border-b px-5 py-3">
    <h3 class="card-title text-base">${esc(opts.title)}</h3>
    ${opts.actions ? `<div class="card-actions">${opts.actions}</div>` : ""}
  </div>` : ""}
  <div class="card-body p-5">${opts.body}</div>
  ${opts.footer ? `<div class="border-base-300 bg-base-200 text-base-content/60 border-t px-5 py-3 text-xs">${opts.footer}</div>` : ""}
</div>`;
}
