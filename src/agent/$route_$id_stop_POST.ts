/** Handles the id stop post HTTP route.  * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request;
        /** Values bound to the operation. */
params: Record<string, string> }) {
    const id = opts.params.id!;
    const agent = (ctx.state as any).agent?.[id];
    const url = new URL(opts.req.url);
    const clearQueue = url.searchParams.get('clearQueue') === '1';
    if (agent) await ctx.fns.agent.stop({ agent, clearQueue });
    return new Response(null, { status: 303, headers: { location: `/agent/${encodeURIComponent(id)}` } });
}
