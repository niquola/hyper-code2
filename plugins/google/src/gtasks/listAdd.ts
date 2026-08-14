// Create a new task list. ctx.fns.gtasks.listAdd({ title }) → created list object
/**
 * Create a Google Tasks list.
 *
 * @param opts - Options for the operation.
 * @param opts.title - Resource title.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { title: string; account?: string }) {
    if (!opts?.title) throw new Error("title is required");
    return ctx.fns.gtasks.api({ path: `/users/@me/lists`, method: "POST", body: { title: opts.title }, account: opts.account });
}
