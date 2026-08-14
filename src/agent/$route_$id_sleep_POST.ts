/** Handles the id sleep post HTTP route.  * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request;
        /** Values bound to the operation. */
params: Record<string, string> }) {
    const id = opts.params.id!;
    const agent = (ctx.state as any).agent?.[id] ?? await ctx.fns.session.load({ id });
    if (!agent) return new Response('not found', { status: 404 });
    const form = await opts.req.formData();
    const action = String(form.get('action') ?? 'prepare');
    try {
        if (action === 'activate') await ctx.fns.agent.setSleepActive({ id, active: true, revision: form.get('revision') == null ? undefined : Number(form.get('revision')) });
        else if (action === 'deactivate') await ctx.fns.agent.setSleepActive({ id, active: false });
        else await ctx.fns.agent.sleep({ agent, force: true });
    } catch (error: any) {
        return new Response(error?.message ?? 'sleep failed', { status: 400 });
    }
    return new Response(null, { status: 204, headers: { 'HX-Refresh': 'true' } });
}
