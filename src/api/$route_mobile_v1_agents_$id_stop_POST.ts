/** Stops a running agent from the native mobile client. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    let agent = (ctx.state as any).agent?.[id];
    if (!agent) {
        agent = await ctx.fns.session.load({ id });
        if (agent) { (ctx.state as any).agent ??= {}; (ctx.state as any).agent[id] = agent; }
    }
    if (!agent) return Response.json({ error: "not_found", message: "Agent not found" }, { status: 404 });
    await ctx.fns.agent.stop({ agent, clearQueue: true });
    return Response.json({ version: 1, ok: true, agentId: id });
}
