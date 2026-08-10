// Update a task's fields (title/notes/due/status). `list` defaults to the first list.
// `due`: "YYYY-MM-DD" (→ RFC3339 midnight UTC) or full RFC3339. status: needsAction|completed.
// ctx.fns.gtasks.update({ task, list?, title?, notes?, due?, status?, account? }) → updated task
export default async function (ctx: Context, session: Session | null, opts: { task: string; list?: string; title?: string; notes?: string; due?: string; status?: "needsAction" | "completed"; account?: string }) {
    if (!opts?.task) throw new Error("task id is required");
    let list = opts.list;
    if (!list) { const all = await ctx.fns.gtasks.lists({ account: opts.account }); if (!all.length) throw new Error("No task lists found"); list = all[0].id; }
    const body: any = { id: opts.task };
    if (opts.title !== undefined) body.title = opts.title;
    if (opts.notes !== undefined) body.notes = opts.notes;
    if (opts.due !== undefined) body.due = opts.due.includes("T") ? opts.due : `${opts.due}T00:00:00.000Z`;
    if (opts.status !== undefined) { body.status = opts.status; if (opts.status === "needsAction") body.completed = null; }
    return ctx.fns.gtasks.api({ path: `/lists/${list}/tasks/${opts.task}`, method: "PATCH", body, account: opts.account });
}
