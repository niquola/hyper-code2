/** Handles the HTTP route control.js GET endpoint. */
export default async function (ctx: Context, _session: Session | null, _opts: {
        /** Incoming HTTP request. */ req: Request;
        /** Route parameters captured from the request path. */ params: Record<string, string> }) {
    return new Response(await ctx.fns.ui.controlScript({}), { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' } });
}
