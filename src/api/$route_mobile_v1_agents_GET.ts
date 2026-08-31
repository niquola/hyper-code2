/** Lists active Hyper agents for the native mobile client. */
export default async function (ctx: Context, _session: Session | null, _opts: { req: Request; params: Record<string, string> }) {
    const agents = await ctx.fns.session.list({});
    const pins = new Set(((await ctx.fns.procs.db.select({ sql: "SELECT substring(key FROM 18) AS id FROM kv WHERE key LIKE 'mobile-pin-agent:%'", params: [] })) as any[]).map(row => String(row.id)));
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
            workspaceDir: agent.workspaceDir,
            pinned: pins.has(agent.id),
            delegated: agent.delegated,
            visibility: agent.visibility,
        })),
    });
}
