export default async function (
    ctx: Context,
    session: Session | null,
    opts: { agent: types.agent.Agent; dir: string },
): Promise<string> {
    const dir = await ctx.fns.workspace.normalize({ dir: opts.dir });
    await ctx.fns.procs.db.run({
        sql: "UPDATE agents SET workspace_dir = ?, updated_at = ? WHERE id = ?",
        params: [dir, Date.now(), opts.agent.id],
    });
    opts.agent.workspaceDir = dir;
    if (session?.agentId === opts.agent.id) session.workspaceDir = dir;
    await ctx.fns.events.emitAgentsChanged({ agentId: opts.agent.id, reason: "workspace" });
    return dir;
}