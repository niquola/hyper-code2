// Rename a task list. ctx.fns.gtasks.listUpdate({ list, title }) → updated list object
/**
 * Update a Google Tasks list.
 *
 * @param opts - Options for the operation.
 * @param opts.list - Task-list identifier; defaults to the first list where supported.
 * @param opts.title - Resource title.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { list: string; title: string; account?: string }) {
    if (!opts?.list || !opts?.title) throw new Error("gtasks.listUpdate requires { list, title }");
    return ctx.fns.gtasks.api({ path: `/users/@me/lists/${opts.list}`, method: "PATCH", body: { title: opts.title }, account: opts.account });
}
