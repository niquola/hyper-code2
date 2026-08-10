// Get a single task by id. `list` defaults to the first task list.
// ctx.fns.gtasks.get({ task, list?, account? })
// → full task object from the Tasks API
export default async function (ctx: Context, session: Session | null, opts: { task: string; list?: string; account?: string }) {
    let list = opts.list;
    if (!list) {
        const all = await ctx.fns.gtasks.lists({ account: opts.account });
        if (all.length === 0) throw new Error("No task lists found");
        list = all[0].id;
    }
    return ctx.fns.gtasks.api({ path: `/lists/${list}/tasks/${opts.task}`, account: opts.account });
}
