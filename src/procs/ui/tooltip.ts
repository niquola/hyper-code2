// A hint on hover or focus — a label for an icon button, the full text of a
// truncated cell. daisyUI's `tooltip` draws the bubble from `data-tip`, CSS only.
export default function (ctx: Context, _session: Session | null, opts: {label: string; children: string; class?: string }): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    return `<span class="tooltip ${opts.class ?? ""}" tabindex="0" data-tip="${esc(opts.label)}">${opts.children}</span>`;
}
