// Clear (permanently hide) all completed tasks in a list. `list` defaults to the first list.
// ctx.fns.gtasks.clear({ list? }) → { cleared: list }
export default async function (ctx: Context, session: Session | null, opts?: { list?: string; account?: string }) {
    let list = opts?.list;
    if (!list) { const all = await ctx.fns.gtasks.lists({ account: opts?.account }); if (!all.length) throw new Error("No task lists found"); list = all[0].id; }
    await ctx.fns.gtasks.api({ path: `/lists/${list}/clear`, method: "POST", account: opts?.account });
    return { cleared: list };
}
