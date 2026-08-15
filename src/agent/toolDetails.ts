/** Tool details for the runtime.  * @param opts.agentId Target agent identifier.
 * @param opts.idx Transcript index of the tool call.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Agent id used by the operation. */
agentId: string;
        /** Zero-based message or event index. */
idx: number }): Promise<Response> {
    const id = String(opts.agentId ?? '');
    const idx = Number(opts.idx);
    if (!id || !Number.isInteger(idx)) return new Response('bad tool event', { status: 400 });
    const events = await ctx.fns.session.getEvents({ id, fromIdx: idx, limit: 1 });
    const event = events[0];
    if (!event || Number(event.idx) !== idx || event.type !== 'tool_call') return new Response('<div class="text-base-content/40">(no body)</div>', { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
    const result = String(event.result ?? '');
    const argsLang = ctx.fns.agent.toolLang({ name: event.name, args: event.args, part: 'args' });
    const argsCode = argsLang === 'json' ? JSON.stringify(event.args ?? {}, null, 2) : String(event.args?.code ?? event.args?.command ?? event.args?.content ?? '');
    const argsHtml = event.name === 'edit'
        ? await ctx.fns.agent.renderEditArgs({ path: event.args?.path, edits: event.args?.edits })
        : await ctx.fns.markdown.highlight({ code: argsCode, lang: argsLang });
    const resultHtml = await ctx.fns.agent.highlightResult({ output: result, lang: ctx.fns.agent.toolLang({ name: event.name, args: event.args, part: 'result' }) });
    const html = `<div class="border-t border-base-300 bg-base-200/60 px-3 py-2 tool-code">${argsHtml}</div>`
        + (result ? `<div class="border-t border-base-300 px-3 py-2 text-base-content/70 tool-result">${resultHtml}</div>` : '');
    return new Response(ctx.fns.ui.popupContent({ title: String(event.name ?? 'Tool'), kind: 'tool', html }), { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
