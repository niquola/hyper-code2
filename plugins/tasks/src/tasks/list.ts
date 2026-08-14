/**
 * Lists tasks, optionally filtered by status.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
  /** Optional task status filter. */
  status?: "todo" | "running" | "done" } = {},
): Promise<types.tasks.Task[]> {
    return await ctx.fns.procs.db.select({
        sql: `SELECT id::text, description, status, agent_id AS "agentId",
                     workspace_mode AS "workspaceMode", workspace_dir AS "workspaceDir",
                     created_at AS "createdAt", updated_at AS "updatedAt"
                FROM tasks.task
               WHERE (?::text IS NULL OR status = ?)
               ORDER BY created_at DESC`,
        params: [opts.status ?? null, opts.status ?? null],
    }) as types.tasks.Task[];
}
