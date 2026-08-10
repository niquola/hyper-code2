// Add/remove labels on a message. Covers markAsRead ({remove:["UNREAD"]}),
// archive ({remove:["INBOX"]}), star ({add:["STARRED"]}), etc.
export default async function (ctx: Context, session: Session | null, opts: { id: string; add?: string[]; remove?: string[]; account?: string }) {
    await ctx.fns.gmail.api({
        path: `/messages/${opts.id}/modify`, method: "POST", account: opts.account,
        body: { addLabelIds: opts.add ?? [], removeLabelIds: opts.remove ?? [] },
    });
    return { modified: opts.id, add: opts.add ?? [], remove: opts.remove ?? [] };
}
