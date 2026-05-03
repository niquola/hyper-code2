export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    const agent = (ctx.state as any).agent?.[id] ?? ctx.fns.session.load(ctx, { id });
    if (!agent) return new Response("Not Found", { status: 404 });
    const child = ctx.fns.session.fork(ctx, { id });
    return new Response(null, { status: 303, headers: { location: `/agent/${encodeURIComponent(child.id)}` } });
}
