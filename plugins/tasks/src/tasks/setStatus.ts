export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { id: string; status: "todo" | "running" | "done" },
): Promise<types.tasks.Task> {
    if (!['todo', 'running', 'done'].includes(opts.status)) throw new Error("tasks.setStatus: invalid status");
    const rows = await ctx.fns.procs.db.select({
        sql: `UPDATE tasks.task SET status = ?, updated_at = ? WHERE id = ?::uuid
              RETURNING id::text, description, status, agent_id AS "agentId",
                        workspace_mode AS "workspaceMode", workspace_dir AS "workspaceDir",
                        created_at AS "createdAt", updated_at AS "updatedAt"`,
        params: [opts.status, Date.now(), opts.id],
    }) as types.tasks.Task[];
    if (!rows[0]) throw new Error(`tasks.setStatus: task ${opts.id} not found`);
    return rows[0];
}
