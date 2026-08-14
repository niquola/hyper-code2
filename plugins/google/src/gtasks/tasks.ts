// List tasks of a task list. `list` defaults to the first task list (@default).
// ctx.fns.gtasks.tasks({ list?, max?, completed?, hidden?, dueMin?, dueMax?, account? })
// → [{ id, title, status, due?, completed?, notes?, parent?, position, updated }]
/**
 * List tasks in a Google Tasks list.
 *
 * @param opts - Options for the operation.
 * @param opts.list - Task-list identifier; defaults to the first list where supported.
 * @param opts.max - Maximum number of results to return.
 * @param opts.completed - Completion timestamp or completion state.
 * @param opts.hidden - Whether hidden tasks should be included.
 * @param opts.dueMin - Minimum task due timestamp.
 * @param opts.dueMax - Maximum task due timestamp.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts?: { list?: string; max?: number; completed?: boolean; hidden?: boolean; dueMin?: string; dueMax?: string; account?: string },
) {
    let list = opts?.list;
    if (!list) {
        const all = await ctx.fns.gtasks.lists({ account: opts?.account });
        if (all.length === 0) throw new Error("No task lists found");
        list = all[0].id;
    }

    const params = new URLSearchParams();
    params.set("maxResults", String(opts?.max ?? 100));
    if (opts?.completed !== undefined) params.set("showCompleted", String(opts.completed));
    if (opts?.hidden !== undefined) params.set("showHidden", String(opts.hidden));
    if (opts?.dueMin) params.set("dueMin", opts.dueMin);
    if (opts?.dueMax) params.set("dueMax", opts.dueMax);

    const res = await ctx.fns.gtasks.api({ path: `/lists/${list}/tasks?${params.toString()}`, account: opts?.account });
    return (res?.items ?? []).map((t: any) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        ...(t.due ? { due: t.due } : {}),
        ...(t.completed ? { completed: t.completed } : {}),
        ...(t.notes ? { notes: t.notes } : {}),
        ...(t.parent ? { parent: t.parent } : {}),
        position: t.position,
        updated: t.updated,
    }));
}
