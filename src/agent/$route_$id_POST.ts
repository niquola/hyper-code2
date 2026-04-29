export default async function (ctx: Context, _session: any, req: any) {
    const id = req.params.id;
    const agent = (ctx.state as any).agent?.[id];
    if (!agent) return Response.json({ error: "not found" }, { status: 404 });
    const text = (await req.text()).trim();
    if (!text) return Response.json({ error: "empty input" }, { status: 400 });
    if (agent.isStreaming) return Response.json({ error: "agent busy" }, { status: 409 });

    const offset = agent.events.length;
    const optimistic = { type: "user", text };
    ctx.fns.session?.appendEvent?.(ctx, agent.id, optimistic);
    ctx.fns.session?.syncAgentState?.(ctx, agent);
    agent.isStreaming = true;
    queueMicrotask(async () => {
        try { await ctx.fns.agent.run(ctx, agent, text); }
        catch (e: any) {
            const ev = { type: "error", error: e.message };
            ctx.fns.session?.appendEvent?.(ctx, agent.id, ev);
            ctx.fns.session?.syncAgentState?.(ctx, agent);
        }
        finally { agent.isStreaming = false; }
    });
    return Response.json({ offset, nextOffset: agent.events.length });
}
