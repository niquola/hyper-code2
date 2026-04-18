export default async function (ctx: Context, _session: any, _req: Request) {
    const agent = (ctx.state as any).agent?.default;
    if (agent) ctx.fns.agent.clear(ctx, agent);
    return Response.json({ ok: true });
}
