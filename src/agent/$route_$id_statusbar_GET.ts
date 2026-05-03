export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    // Guard against polls for missing/archived agents — without this the
    // statusbar 200s on non-existent ids while page and events.html 404,
    // leaving a half-broken polling cycle running in the user's tab.
    const row = ctx.fns.db.select<any>(ctx, { sql: 'SELECT id FROM agents WHERE id = ?', params: [id] })[0];
    if (!row) return new Response('not found', { status: 404 });
    const html = ctx.fns.agent.renderStatusBar(ctx, { agentId: id });
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
