/** Handles the id fork post HTTP route.  * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request;
        /** Values bound to the operation. */
params: Record<string, string> }) {
    const id = opts.params.id!;
    const agent = (ctx.state as any).agent?.[id] ?? await ctx.fns.session.load({ id });
    if (!agent) return new Response("Not Found", { status: 404 });
    const child = await ctx.fns.session.fork({ id });
    return new Response(null, { status: 303, headers: { location: `/agent/${encodeURIComponent(child.id)}` } });
}
