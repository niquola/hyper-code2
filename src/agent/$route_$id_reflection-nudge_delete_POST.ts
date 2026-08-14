/** Handles the id reflection-nudge delete post HTTP route.  * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request;
        /** Values bound to the operation. */
params: Record<string, string> }) {
    try {
        await ctx.fns.agent.clearReflectionNudge({ id: opts.params.id! });
    } catch (error: any) {
        return new Response(error?.message ?? 'not found', { status: 404 });
    }
    if (opts.req.headers.get('hx-request') === 'true') {
        return new Response('', { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    return new Response(null, { status: 303, headers: { location: `/agent/${encodeURIComponent(opts.params.id!)}` } });
}
