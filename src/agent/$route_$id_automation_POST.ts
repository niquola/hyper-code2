/** Handles the id automation post HTTP route.  * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request;
        /** Values bound to the operation. */
params: Record<string, string> }) {
    const form = await opts.req.formData();
    try {
        await ctx.fns.agent.setAutomation({
            id: opts.params.id!,
            reflectionEnabled: form.get('reflectionEnabled') === '1',
            sleepEnabled: form.get('sleepEnabled') === '1',
        });
    } catch (error: any) {
        return new Response(error?.message ?? 'Invalid automation settings', { status: 400 });
    }
    return new Response(null, { status: 204 });
}
