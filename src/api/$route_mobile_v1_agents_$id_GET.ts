/** Returns one agent and its current execution status for the native mobile client. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    const row = ((await ctx.fns.procs.db.select({
        sql: `SELECT id, title, model, workspace_dir AS "workspaceDir", run_state AS "runState",
                     run_started_at AS "runStartedAt", next_run_at AS "nextRunAt",
                     last_processed_msg_idx AS "lastProcessedMessageIdx", last_error AS "lastError", updated_at AS "updatedAt"
              FROM agents WHERE id = ?`,
        params: [id],
    })) as any[])[0];
    if (!row) return Response.json({ error: "not_found", message: "Agent not found" }, { status: 404 });
    return Response.json({
        version: 1,
        agent: {
            id: row.id,
            title: row.title || row.id,
            model: row.model,
            workspaceDir: row.workspaceDir || "",
            runState: row.runState || "idle",
            runStartedAt: row.runStartedAt == null ? null : Number(row.runStartedAt),
            nextRunAt: row.nextRunAt == null ? null : Number(row.nextRunAt),
            lastProcessedMessageIdx: row.lastProcessedMessageIdx == null ? null : Number(row.lastProcessedMessageIdx),
            lastError: row.lastError || null,
            updatedAt: Number(row.updatedAt),
        },
    });
}
