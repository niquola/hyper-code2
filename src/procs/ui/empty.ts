// Nothing here yet — but say what would go here and how to make the first one.
// An icon, a line, and an optional action, centred in the space a list would
// have filled. `data-role="empty"` so the workspace can tell empty from loading.
export default function (ctx: Context, _session: Session | null, opts: {icon?: string; title: string; text?: string; action?: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    return `<div class="flex flex-col items-center justify-center rounded-md border border-dashed border-base-300 px-6 py-12 text-center" ${ctx.fns.procs.ui.attr({ role: "empty" })}>
  <i class="ph ${esc(opts.icon ?? "ph-tray")} text-2xl text-base-content/40" aria-hidden="true"></i>
  <p class="mt-2 text-sm font-medium text-base-content">${esc(opts.title)}</p>
  ${opts.text ? `<p class="mt-1 max-w-sm text-xs text-base-content/60">${esc(opts.text)}</p>` : ""}
  ${opts.action ? `<div class="mt-4">${opts.action}</div>` : ""}
</div>`;
}
