/** Handles the id wake post HTTP route.  * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request;
        /** Values bound to the operation. */
params: Record<string, string> }) {
    const form = await opts.req.formData();
    const action = String(form.get('action') ?? 'set');
    try {
        if (action === 'cancel') await ctx.fns.agent.cancelWake({ id: opts.params.id! });
        else {
            const preset = form.get('preset');
            const rawMinutes = preset != null ? preset : form.get('minutes');
            const minutes = Math.max(1, Math.min(7 * 24 * 60, Number(rawMinutes ?? 5)));
            await ctx.fns.agent.wakeIn({ id: opts.params.id!, delayMs: minutes * 60_000, reason: String(form.get('reason') ?? 'Continue scheduled work') });
        }
    } catch (error: any) {
        return new Response(error?.message ?? 'Invalid wake-up', { status: 400 });
    }
    return new Response(null, { status: 204 });
}
