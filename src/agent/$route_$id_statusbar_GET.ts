export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    const html = ctx.fns.agent.renderStatusBar(ctx, id);
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
