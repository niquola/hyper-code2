export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    const agent = (ctx.state as any).agent?.[id];
    if (!agent) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(ctx.fns.agent.stop(ctx, agent));
}
