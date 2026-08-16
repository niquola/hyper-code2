/** Handles the id statusbar get HTTP route.  * @param opts.req Incoming HTTP request.
 * @param opts.params Route path parameters.
*/
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Incoming HTTP request. */
req: Request;
        /** Values bound to the operation. */
params: Record<string, string> }) {
    const id = opts.params.id!;
    // Guard against polls for missing/archived agents — without this the
    // statusbar 200s on non-existent ids while page and events.html 404,
    // leaving a half-broken polling cycle running in the user's tab.
    const row = ((await ctx.fns.procs.db.select({ sql: 'SELECT id FROM agents WHERE id = ?', params: [id] })) as any[])[0];
    if (!row) return new Response('not found', { status: 404 });
    const part = new URL(opts.req.url).searchParams.get('part') === 'stop' ? 'stop' : 'status';
    const html = await ctx.fns.agent.renderStatusBar({ agentId: id, part: part as 'status' | 'stop' });
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
