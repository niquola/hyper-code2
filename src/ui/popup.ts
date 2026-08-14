export default function (
    ctx: Context,
    _session: Session | null,
    opts: { method: string; params?: Record<string, any>; html: string; attrs?: string },
): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    return `<button type="button" hx-popup="${esc(opts.method)}" hx-popup-params="${esc(JSON.stringify(opts.params ?? {}))}"${opts.attrs ? ` ${opts.attrs}` : ''}>${opts.html}</button>`;
}
