export default async function (ctx: Context, _session: Session | null, opts: any): Promise<Response> {
    const result = await ctx.fns.agent.createFromValues(opts);
    if (result.error) return new Response(result.error, { status: 400 });
    if (result.confirmation) {
        const esc = (v: any) => ctx.fns.procs.ui.escape({ text: v });
        const hidden = Object.entries(result.confirmation.values).flatMap(([name, value]: any) => (Array.isArray(value) ? value : [value]).map(value => `<input type="hidden" name="${esc(name)}" value="${esc(value)}">`)).join('');
        return new Response(ctx.fns.ui.popupContent({ title: 'Create workspace', kind: 'new-agent', html: `<p class="text-sm text-gray-600">Create <code>${esc(result.confirmation.dir)}</code>?</p><form hx-popup="agent.createFromPopup" title="Create workspace">${hidden}<input type="hidden" name="createWorkspaceDir" value="1"><button class="mt-4 rounded bg-gray-900 px-4 py-2 text-white">Create directory and agent</button></form>` }), { headers: { 'content-type': 'text/html' } });
    }
    return new Response('', { status: 204, headers: { 'HX-Redirect': `/agent/${encodeURIComponent(result.agent.id)}` } });
}
