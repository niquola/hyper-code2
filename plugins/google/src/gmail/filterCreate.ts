// gmail.filterCreate — create ONE Gmail server-side filter. LIVE change to the mailbox.
//   criteria: from | to | subject | query (Gmail search) | hasAttachment
//   action shortcuts: archive (skip Inbox) | markRead | del (trash) | star | labelId
//   ctx.fns.gmail.filterCreate({ account, from: "@whova.io", archive: true })
//   ctx.fns.gmail.filterCreate({ account, query: "from:(a OR b)", archive: true, markRead: true })
export default async function (ctx: Context, _session: Session | null, opts: {
    account?: string; from?: string; to?: string; subject?: string; query?: string; hasAttachment?: boolean;
    archive?: boolean; markRead?: boolean; del?: boolean; star?: boolean; labelId?: string;
}) {
    const criteria: any = {};
    for (const k of ["from", "to", "subject", "query"] as const) if (opts[k]) criteria[k] = opts[k];
    if (opts.hasAttachment) criteria.hasAttachment = true;
    if (!Object.keys(criteria).length) throw new Error("filterCreate: need at least one criterion (from/to/subject/query)");

    const addLabelIds: string[] = []; const removeLabelIds: string[] = [];
    if (opts.archive) removeLabelIds.push("INBOX");
    if (opts.markRead) removeLabelIds.push("UNREAD");
    if (opts.del) addLabelIds.push("TRASH");
    if (opts.star) addLabelIds.push("STARRED");
    if (opts.labelId) addLabelIds.push(opts.labelId);
    const action: any = {};
    if (addLabelIds.length) action.addLabelIds = addLabelIds;
    if (removeLabelIds.length) action.removeLabelIds = removeLabelIds;
    if (!Object.keys(action).length) throw new Error("filterCreate: need an action (archive/markRead/del/star/labelId)");

    return ctx.fns.gmail.api({ account: opts.account, method: "POST", path: "/settings/filters", body: { criteria, action } })
        .catch((e: any) => String(e).includes("already exists") ? { existed: true, criteria, action } : Promise.reject(e));
}
