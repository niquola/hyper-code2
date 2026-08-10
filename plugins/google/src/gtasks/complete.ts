// Mark a task completed (or, with done:false, reopen it). `list` defaults to the first task list.
// ctx.fns.gtasks.complete({ task, list?, done?, account? })
// → updated task object
export default async function (ctx: Context, session: Session | null, opts: { task: string; list?: string; done?: boolean; account?: string }) {
    if (!opts.task) throw new Error("task id is required");
    let list = opts.list;
    if (!list) {
        const all = await ctx.fns.gtasks.lists({ account: opts.account });
        if (all.length === 0) throw new Error("No task lists found");
        list = all[0].id;
    }
    const status = opts.done === false ? "needsAction" : "completed";
    const body: any = { id: opts.task, status };
    // Reopening: clear the completed timestamp so the API accepts the transition.
    if (status === "needsAction") body.completed = null;
    return ctx.fns.gtasks.api({ path: `/lists/${list}/tasks/${opts.task}`, method: "PATCH", body, account: opts.account });
}
