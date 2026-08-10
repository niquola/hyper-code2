// Create a task. `list` defaults to the first task list.
// `due` accepts "YYYY-MM-DD" (coerced to RFC3339 midnight UTC) or a full RFC3339 timestamp.
// `parent`/`previous` position the task as a subtask / after another task.
// ctx.fns.gtasks.add({ title, list?, notes?, due?, parent?, previous?, account? })
// → created task object
export default async function (
    ctx: Context,
    session: Session | null,
    opts: { title: string; list?: string; notes?: string; due?: string; parent?: string; previous?: string; account?: string },
) {
    if (!opts.title) throw new Error("title is required");
    let list = opts.list;
    if (!list) {
        const all = await ctx.fns.gtasks.lists({ account: opts.account });
        if (all.length === 0) throw new Error("No task lists found");
        list = all[0].id;
    }

    const body: any = { title: opts.title };
    if (opts.notes) body.notes = opts.notes;
    if (opts.due) body.due = opts.due.includes("T") ? opts.due : `${opts.due}T00:00:00.000Z`;

    const params = new URLSearchParams();
    if (opts.parent) params.set("parent", opts.parent);
    if (opts.previous) params.set("previous", opts.previous);
    const query = params.toString() ? `?${params.toString()}` : "";

    return ctx.fns.gtasks.api({ path: `/lists/${list}/tasks${query}`, method: "POST", body, account: opts.account });
}
