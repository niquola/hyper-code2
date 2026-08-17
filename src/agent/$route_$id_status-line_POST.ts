/** Handles the id status-line post HTTP route.  * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request;
        /** Values bound to the operation. */
params: Record<string, string> }) {
    const form = await opts.req.formData();
    const text = String(form.get('text') ?? '');
    const every = Number(form.get('every') ?? 1);
    try {
        await ctx.fns.agent.setStatusLine({
            id: opts.params.id!,
            text,
            every,
        });
    } catch (error: any) {
        return new Response(error?.message ?? 'Invalid status line', { status: 400 });
    }
    const esc = (value: string) => ctx.fns.procs.ui.escape({ text: value });
    const label = text.trim() || 'add prompt inject…';
    const suffix = text.trim() && every > 1 ? ` · every ${every} turns` : '';
    return new Response(`<i class="ph ph-note-pencil mr-1"></i>${esc(label)}${esc(suffix)}`, {
        headers: { 'content-type': 'text/html; charset=utf-8' },
    });
}
