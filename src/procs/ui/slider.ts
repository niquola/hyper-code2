// A range — a scale (pain 0–10), a threshold. Native input; `data-field` on the
// wrapper so page.fill drives it. The value beside it is the initial one.
/**
 * Perform slider for the ui subsystem.
 * @param opts.name The target name.
 * @param opts.min The min value used by the operation.
 * @param opts.max The max value used by the operation.
 * @param opts.value The value to apply.
 * @param opts.step The step value used by the operation.
 * @param opts.class CSS classes to apply.
 */
export default function (ctx: Context, _session: Session | null, opts: {name: string; min?: number; max?: number; value?: number; step?: number; class?: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const min = opts.min ?? 0, max = opts.max ?? 10;
    return `<div class="flex items-center gap-3 ${opts.class ?? ""}" ${ctx.fns.procs.ui.attr({ field: opts.name })}>
  <input type="range" name="${esc(opts.name)}" min="${min}" max="${max}" step="${opts.step ?? 1}" value="${opts.value ?? min}" class="ui-range h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-base-200 accent-primary" aria-label="${esc(opts.name)}">
  <output class="w-8 shrink-0 text-right font-mono text-sm tabular-nums text-base-content">${opts.value ?? min}</output>
</div>`;
}
