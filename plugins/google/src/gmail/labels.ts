// List all labels with counts. ctx.fns.gmail.labels({})
/**
 * List Gmail labels.
 *
 * @param opts - Options for the operation.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts?: { account?: string }) {
    const res = await ctx.fns.gmail.api({ path: "/labels", account: opts?.account });
    return (res?.labels ?? []).map((l: any) => ({
        id: l.id, name: l.name, type: l.type,
        messagesTotal: l.messagesTotal, messagesUnread: l.messagesUnread,
    }));
}
