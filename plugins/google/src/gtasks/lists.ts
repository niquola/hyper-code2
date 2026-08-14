// List the account's task lists.
// ctx.fns.gtasks.lists({ account? })
// → [{ id, title, updated }]
/**
 * List Google Tasks lists.
 *
 * @param opts - Options for the operation.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts?: { account?: string }) {
    const res = await ctx.fns.gtasks.api({ path: "/users/@me/lists?maxResults=100", account: opts?.account });
    return (res?.items ?? []).map((l: any) => ({ id: l.id, title: l.title, updated: l.updated }));
}
