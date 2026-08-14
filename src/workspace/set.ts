/** Changes the current session workspace directory. */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: { /** Git working directory. */ dir: string; /** Agent associated with the operation. */ agent?: types.agent.Agent },
): Promise<string> {
    const agent = opts.agent ?? session?.agent;
    if (!agent) throw new Error("workspace.set requires an agent session");
    const dir = await ctx.fns.workspace.normalize({ dir: opts.dir });
    await ctx.fns.procs.db.run({
        sql: "UPDATE agents SET workspace_dir = ?, updated_at = ? WHERE id = ?",
        params: [dir, Date.now(), agent.id],
    });
    agent.workspaceDir = dir;
    await ctx.fns.events.emitAgentsChanged({ agentId: agent.id, reason: "workspace" });
    return dir;
}