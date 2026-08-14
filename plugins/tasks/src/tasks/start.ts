import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Starts a task by attaching and running an agent.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
  /** Task identifier. */
  id: string;
  /** Optional model override for the task agent. */
  model?: string },
): Promise<types.tasks.Task> {
    const task = await ctx.fns.tasks.get({ id: opts.id });
    if (!task) throw new Error(`tasks.start: task ${opts.id} not found`);
    if (task.agentId) return task;

    const tasksDir = resolve(process.env.HOME ?? "~", ".hyper", "tasks");
    const workspaceDir = task.workspaceMode === "isolated"
        ? resolve(tasksDir, task.id)
        : tasksDir;
    await mkdir(workspaceDir, { recursive: true });

    const model = opts.model?.trim() || await ctx.fns.settings.modelDefault({});
    const title = task.description.replace(/\s+/g, " ").slice(0, 80);
    const child = await ctx.fns.agent.start({
        model,
        title,
        workspaceDir,
        systemPrompt: `You are the agent attached to task ${task.id}. Work only on the task described by the user. The task tracker does not infer completion from the end of a model turn; report your result clearly so the user can explicitly mark the task done.`,
    });

    const now = Date.now();
    const claimed = await ctx.fns.procs.db.select({
        sql: `UPDATE tasks.task
                 SET agent_id = ?, workspace_dir = ?, status = 'running', updated_at = ?
               WHERE id = ?::uuid AND agent_id IS NULL
               RETURNING id::text, description, status, agent_id AS "agentId",
                         workspace_mode AS "workspaceMode", workspace_dir AS "workspaceDir",
                         created_at AS "createdAt", updated_at AS "updatedAt"`,
        params: [child.id, workspaceDir, now, task.id],
    }) as types.tasks.Task[];

    if (!claimed[0]) {
        await ctx.fns.session.archive({ id: child.id }).catch(() => undefined);
        const current = await ctx.fns.tasks.get({ id: task.id });
        if (!current) throw new Error(`tasks.start: task ${task.id} disappeared`);
        return current;
    }

    await ctx.fns.session.appendUserMessage({ id: child.id, text: task.description });
    await ctx.fns.session.syncAgentState({ agent: child });
    await ctx.fns.procs.db.run({
        sql: `UPDATE agents SET next_run_at = ?, updated_at = ? WHERE id = ?`,
        params: [now, now, child.id],
    });
    ctx.fns.agent.wakeWorker({});
    ctx.fns.events.emitAgentsChanged({ agentId: child.id, reason: "task-start" });
    return claimed[0];
}
