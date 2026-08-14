// List drafts. ctx.fns.gmail.drafts({ max: 10 })
/**
 * List Gmail drafts.
 *
 * @param opts - Options for the operation.
 * @param opts.max - Maximum number of results to return.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts?: { max?: number; account?: string }) {
    const res = await ctx.fns.gmail.api({ path: `/drafts?maxResults=${opts?.max ?? 20}`, account: opts?.account });
    return (res?.drafts ?? []).map((d: any) => ({ id: d.id, message: { id: d.message.id, threadId: d.message.threadId } }));
}
