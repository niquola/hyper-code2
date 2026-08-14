/**
 * Creates a new task.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
  /** Task instructions or description. */
  description: string;
  /** Workspace strategy: reuse the default workspace or create an isolated one. */
  workspaceMode?: "default" | "isolated" },
): Promise<types.tasks.Task> {
    const description = String(opts.description ?? "").trim();
    if (!description) throw new Error("tasks.create: description is required");
    const workspaceMode = opts.workspaceMode ?? "default";
    if (workspaceMode !== "default" && workspaceMode !== "isolated") {
        throw new Error("tasks.create: workspaceMode must be default or isolated");
    }
    const id = Bun.randomUUIDv7();
    const now = Date.now();
    const rows = await ctx.fns.procs.db.select({
        sql: `INSERT INTO tasks.task
              (id, description, status, workspace_mode, created_at, updated_at)
              VALUES (?, ?, 'todo', ?, ?, ?)
              RETURNING id::text, description, status, agent_id AS "agentId",
                        workspace_mode AS "workspaceMode", workspace_dir AS "workspaceDir",
                        created_at AS "createdAt", updated_at AS "updatedAt"`,
        params: [id, description, workspaceMode, now, now],
    }) as types.tasks.Task[];
    return rows[0]!;
}
