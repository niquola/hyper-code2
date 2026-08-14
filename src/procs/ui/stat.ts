// One number that matters: a label, the value, and an optional unit or delta
// beside it. The tone tints the value — a severity, a pass/fail — nothing else.
const TONE = {
    info: "text-info", success: "text-success",
    warning: "text-warning", danger: "text-error",
} as const;

/**
 * Perform stat for the ui subsystem.
 * @param opts.label The display label.
 * @param opts.value The value to apply.
 * @param opts.sub The sub value used by the operation.
 * @param opts.tone The tone value used by the operation.
 * @param opts.role The role value used by the operation.
 */
export default function (ctx: Context, _session: Session | null, opts: {label: string; value: string | number; sub?: string; tone?: keyof typeof TONE; role?: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    const tone = opts.tone ? ` ${TONE[opts.tone]}` : "";
    return `<div class="stat border-base-300 bg-base-100 rounded-md border px-4 py-3" ${ctx.fns.procs.ui.attr({ role: opts.role })}>
  <div class="stat-title text-xs">${esc(opts.label)}</div>
  <div class="stat-value text-xl${tone}">${esc(opts.value)}</div>
  ${opts.sub ? `<div class="stat-desc text-xs">${esc(opts.sub)}</div>` : ""}
</div>`;
}
