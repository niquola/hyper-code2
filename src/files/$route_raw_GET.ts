// GET /files/raw?path=... — compatibility endpoint for browser-native media previews.
/** Handles the corresponding HTTP route. */
export default async function (ctx: Context, _session: Session | null, opts: { /** Incoming HTTP request. */ req: Request }) {
    const url = new URL(opts.req.url);
    const path = url.searchParams.get("path") ?? "";
    return ctx.fns.files.rawResponse({ path, method: opts.req.method });
}
