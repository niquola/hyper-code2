// List all labels with counts. ctx.fns.gmail.labels({})
export default async function (ctx: Context, session: Session | null, opts?: { account?: string }) {
    const res = await ctx.fns.gmail.api({ path: "/labels", account: opts?.account });
    return (res?.labels ?? []).map((l: any) => ({
        id: l.id, name: l.name, type: l.type,
        messagesTotal: l.messagesTotal, messagesUnread: l.messagesUnread,
    }));
}
