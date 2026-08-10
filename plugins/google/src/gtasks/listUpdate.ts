// Rename a task list. ctx.fns.gtasks.listUpdate({ list, title }) → updated list object
export default async function (ctx: Context, session: Session | null, opts: { list: string; title: string; account?: string }) {
    if (!opts?.list || !opts?.title) throw new Error("gtasks.listUpdate requires { list, title }");
    return ctx.fns.gtasks.api({ path: `/users/@me/lists/${opts.list}`, method: "PATCH", body: { title: opts.title }, account: opts.account });
}
