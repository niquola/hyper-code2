export default function (
    ctx: Context,
    _session: Session | null,
    opts: { title: string; html: string; kind?: string; class?: string },
): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    return `<section data-popup-content data-popup-title="${esc(opts.title)}" data-popup-kind="${esc(opts.kind ?? '')}" class="${esc(opts.class ?? 'w-full')}">${opts.html}</section>`;
}
