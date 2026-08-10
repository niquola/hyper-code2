// Move/reorder a task within its list (as subtask of `parent` and/or after `previous`).
// `list` defaults to the first list. ctx.fns.gtasks.move({ task, list?, parent?, previous?, account? }) → moved task
export default async function (ctx: Context, session: Session | null, opts: { task: string; list?: string; parent?: string; previous?: string; account?: string }) {
    if (!opts?.task) throw new Error("task id is required");
    let list = opts.list;
    if (!list) { const all = await ctx.fns.gtasks.lists({ account: opts.account }); if (!all.length) throw new Error("No task lists found"); list = all[0].id; }
    const params = new URLSearchParams();
    if (opts.parent) params.set("parent", opts.parent);
    if (opts.previous) params.set("previous", opts.previous);
    const query = params.toString() ? `?${params.toString()}` : "";
    return ctx.fns.gtasks.api({ path: `/lists/${list}/tasks/${opts.task}/move${query}`, method: "POST", account: opts.account });
}
