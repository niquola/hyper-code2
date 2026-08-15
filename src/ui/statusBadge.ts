/**
 * Renders a compact semantic status badge
 *
 * Renders a reusable theme-aware status badge with optional dot. Use for agent, goal, task, team, scheduling, and other compact inspector statuses.
 * @param opts.label Visible status label.
 * @param opts.tone Semantic visual tone for the status. @default neutral
 * @param opts.dot Show a small status dot before the label. @default false
 * @param opts.title Optional tooltip describing the status.
 */
export default function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Visible status label. */
        label: string;
        /** Semantic visual tone for the status. @default neutral */
        tone?: "neutral" | "info" | "success" | "warning" | "error";
        /** Show a small status dot before the label. @default false */
        dot?: boolean;
        /** Optional tooltip describing the status. */
        title?: string;
    },
): string {
    const esc = (value: string) => ctx.fns.procs.ui.escape({ text: value });
    const tones = { neutral: 'badge-ghost text-base-content/60', info: 'badge-info', success: 'badge-success', warning: 'badge-warning', error: 'badge-error' } as const;
    const tone = opts.tone ?? 'neutral';
    return `<span class="badge badge-sm gap-1 whitespace-nowrap ${tones[tone]}"${opts.title ? ` title="${esc(opts.title)}"` : ''}>${opts.dot ? '<span class="size-1.5 rounded-full bg-current" aria-hidden="true"></span>' : ''}${esc(opts.label)}</span>`;
}
