// Add/remove labels on a message. Covers markAsRead ({remove:["UNREAD"]}),
// archive ({remove:["INBOX"]}), star ({add:["STARRED"]}), etc.
/**
 * Add or remove labels on a Gmail message.
 *
 * @param opts - Options for the operation.
 * @param opts.id - Resource identifier.
 * @param opts.add - Label IDs to add.
 * @param opts.remove - Label IDs to remove.
 * @param opts.account - Google account email to use; defaults to `GOOGLE_ACCOUNT` when supported.
 */
export default async function (ctx: Context, session: Session | null, opts: { id: string; add?: string[]; remove?: string[]; account?: string }) {
    await ctx.fns.gmail.api({
        path: `/messages/${opts.id}/modify`, method: "POST", account: opts.account,
        body: { addLabelIds: opts.add ?? [], removeLabelIds: opts.remove ?? [] },
    });
    return { modified: opts.id, add: opts.add ?? [], remove: opts.remove ?? [] };
}
