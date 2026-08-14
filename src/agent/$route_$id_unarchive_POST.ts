// POST /agent/:id/unarchive — back to the rail. Answers 200 with no body: the
// rail button that calls this refreshes the rail itself on success.
/** Handles the id unarchive post HTTP route.  * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request;
        /** Values bound to the operation. */
params: Record<string, string> }) {
    const id = opts.params.id!;
    const { ok } = await ctx.fns.session.unarchive({ id });
    return new Response(ok ? "ok" : "not found", { status: ok ? 200 : 404 });
}
