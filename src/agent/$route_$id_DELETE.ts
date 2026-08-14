/** Handles the id delete HTTP route.  * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request;
        /** Values bound to the operation. */
params: Record<string, string> }) {
    const id = opts.params.id!;
    const agent = (ctx.state as any).agent?.[id];
    if (agent) await ctx.fns.agent.clear({ agent });
    delete (ctx.state as any).agent?.[id];
    try { await ctx.fns.session?.delete?.({ id }); } catch (e: any) { console.error("[session.delete]", e?.message); }
    return Response.json({ ok: true });
}
