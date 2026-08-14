/** Performs the ui.popup runtime operation. */
/**
 * Render a trigger that opens server-provided popup content.
 * @param opts.method RPC method name.
 * @param opts.params RPC method parameters.
 * @param opts.html Initial or inner HTML content.
 * @param opts.attrs Additional HTML attributes.
 */
export default function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Value used for the method option. */ method: string;
        /** Route parameters captured from the request path. */ params?: Record<string, any>;
        /** Rendered HTML content. */ html: string;
        /** Value used for the attrs option. */ attrs?: string },
): string {
    const esc = (s: any) => ctx.fns.procs.ui.escape({ text: s });
    return `<button type="button" hx-popup="${esc(opts.method)}" hx-popup-params="${esc(JSON.stringify(opts.params ?? {}))}"${opts.attrs ? ` ${opts.attrs}` : ''}>${opts.html}</button>`;
}
