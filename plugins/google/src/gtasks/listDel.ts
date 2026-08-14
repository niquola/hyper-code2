// Delete a task list by id. ctx.fns.gtasks.listDel({ list }) → { deleted: list }
/**
 * Delete a Google Tasks list.
 *
 * @param opts - Options for the operation.
 * @param opts.list - Task-list identifier; defaults to the first list where supported.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { list: string; account?: string }) {
    if (!opts?.list) throw new Error("gtasks.listDel requires { list }");
    await ctx.fns.gtasks.api({ path: `/users/@me/lists/${opts.list}`, method: "DELETE", account: opts.account });
    return { deleted: opts.list };
}
