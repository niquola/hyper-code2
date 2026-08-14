/** Handles the id status-line post HTTP route.  * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request;
        /** Values bound to the operation. */
params: Record<string, string> }) {
    const form = await opts.req.formData();
    try {
        await ctx.fns.agent.setStatusLine({
            id: opts.params.id!,
            text: String(form.get('text') ?? ''),
            every: Number(form.get('every') ?? 1),
        });
    } catch (error: any) {
        return new Response(error?.message ?? 'Invalid status line', { status: 400 });
    }
    return new Response(null, { status: 204, headers: { 'HX-Refresh': 'true' } });
}
