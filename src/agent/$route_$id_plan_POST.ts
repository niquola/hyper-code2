export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const id = opts.params.id!;
    const agent = (ctx.state as any).agent?.[id] ?? await ctx.fns.session.load({ id });
    if (!agent) return new Response("not found", { status: 404 });
    try {
        const form = await opts.req.formData();
        const action = String(form.get("action") ?? "archive");
        if (action === "update") {
            const ids = form.getAll("task_id").map(String);
            const titles = form.getAll("task_title").map(String);
            const instructions = form.getAll("task_instructions").map(String);
            if (ids.length !== titles.length || ids.length !== instructions.length) throw new Error("Invalid plan rows");
            const tasks = ids.map((taskId, index) => ({ id: taskId, title: titles[index], instructions: instructions[index] }));
            const result = await ctx.fns.session.updatePlan({ agent, title: String(form.get("title") ?? ""), tasks });
            const active = result.plan?.tasks?.find((task: any) => task.status === "active");
            if (active) {
                // Saving a plan is an instruction to work, not only metadata.
                // Put the active task in the ordinary user queue so an idle
                // agent wakes up and consumes it immediately.
                const text = [
                    "Continue the active plan task.",
                    `Task ID: ${active.id}`,
                    `Title: ${active.title}`,
                    active.instructions ? `Instructions:\n${active.instructions}` : "",
                    `Call session.done({ agent, id: ${JSON.stringify(active.id)} }) only after the task is complete.`,
                ].filter(Boolean).join("\n\n");
                const message = await ctx.fns.session.appendMessage({ id: agent.id, message: {
                    role: "user", content: text, message_type: "plan_activation",
                } });
                await ctx.fns.session.appendEvent({ id: agent.id, event: {
                    type: "plan_activation",
                    taskId: active.id,
                    title: active.title,
                    instructions: active.instructions ?? "",
                    messageIdx: message.idx,
                } });
                await ctx.fns.session.syncAgentState({ agent });
                const now = Date.now();
                await ctx.fns.procs.db.run({
                    sql: "UPDATE agents SET next_run_at = COALESCE(next_run_at, ?), updated_at = ? WHERE id = ?",
                    params: [now, now, agent.id],
                });
                ctx.fns.agent.wakeWorker({});
            }
        } else {
            await ctx.fns.session.removePlan({ agent, archive: action !== "delete" });
        }
        return new Response(null, { status: 204 });
    } catch (error: any) {
        return new Response(error?.message ?? "Invalid plan", { status: 400 });
    }
}
