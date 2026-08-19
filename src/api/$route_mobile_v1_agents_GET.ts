/** Lists active Hyper agents for the native mobile client. */
export default async function (ctx: Context, _session: Session | null, _opts: { req: Request; params: Record<string, string> }) {
    const agents = await ctx.fns.session.list({});
    return Response.json({
        version: 1,
        agents: agents.map(agent => ({
            id: agent.id,
            title: agent.title,
            model: agent.model,
            runState: agent.runState,
            unread: agent.unread,
            turns: agent.turns,
            updatedAt: agent.updatedAt,
            delegated: agent.delegated,
        })),
    });
}
