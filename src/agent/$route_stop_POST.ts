export default async function (ctx: Context, _session: any, _req: Request) {
    const agent = (ctx.state as any).agent?.default;
    if (!agent) return Response.json({ ok: false, error: "no agent" });
    return Response.json(ctx.fns.agent.stop(ctx, agent));
}
