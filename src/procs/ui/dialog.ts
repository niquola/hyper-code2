// A modal, JS-free — the HTML Popover API. A trigger button opens the [popover],
// which sits centred over a dimmed page; clicking outside or the × closes it.
// For a confirm, a form, a detail peek.
// The Popover API stays — it is what makes this JS-free — and daisyUI's
// `modal-box` / `modal-action` dress the panel inside it.
const TONE = {
    default: "btn-outline", primary: "btn-primary", danger: "btn-error btn-outline",
} as const;

export default function (ctx: Context, _session: Session | null, opts: {id: string; trigger: { label: string; tone?: keyof typeof TONE }; title: string; body: string; actions?: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    return `<span>
  <button type="button" class="btn btn-sm ${TONE[opts.trigger.tone ?? "default"]}" popovertarget="${esc(opts.id)}" ${ctx.fns.procs.ui.attr({ action: `open-${opts.id}` })}>${esc(opts.trigger.label)}</button>
  <div id="${esc(opts.id)}" popover class="ui-dialog modal-box max-w-lg p-0" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}">
    <div class="border-base-300 flex items-start justify-between gap-4 border-b px-5 py-3">
      <h2 class="text-base font-semibold">${esc(opts.title)}</h2>
      <button type="button" class="btn btn-sm btn-circle btn-ghost" popovertarget="${esc(opts.id)}" popovertargetaction="hide" aria-label="Close"><i class="ph ph-x" aria-hidden="true"></i></button>
    </div>
    <div class="px-5 py-4">${opts.body}</div>
    ${opts.actions ? `<div class="modal-action border-base-300 bg-base-200 mt-0 border-t px-5 py-3">${opts.actions}</div>` : ""}
  </div>
</span>`;
}
