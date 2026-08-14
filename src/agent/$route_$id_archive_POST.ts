/** Handles the id archive post HTTP route.  * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request;
        /** Values bound to the operation. */
params: Record<string, string> }) {
    const id = opts.params.id!;
    delete (ctx.state as any).agent?.[id];
    try { await ctx.fns.session.archive({ id }); } catch (e: any) { console.error('[session.archive]', e?.message); }
    return new Response(null, { status: 303, headers: { location: '/?archived=' + encodeURIComponent(id) } });
}
