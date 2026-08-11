// Mark messages as read via a narrow (is:unread, optionally scoped to a channel).
// WRITE — clears unread flags on the user's Zulip. ctx.fns.zulip.markRead({ channel?, instance? })
// → { updated } (number of messages marked read)
export default async function (ctx: Context, session: Session | null, opts?: { channel?: string; instance?: string }) {
    const narrow: { operator: string; operand: string }[] = [];
    if (opts?.channel) narrow.push({ operator: "channel", operand: opts.channel });
    narrow.push({ operator: "is", operand: "unread" });
    const data = await ctx.fns.zulip.api({
        path: "/messages/flags/narrow",
        method: "POST",
        form: { anchor: "oldest", num_before: "0", num_after: "5000", narrow: JSON.stringify(narrow), op: "add", flag: "read", include_anchor: "true" },
        instance: opts?.instance,
    });
    return { updated: data.updated_count ?? 0 };
}
