// List messages by Gmail search query (metadata only, batched ×10).
// ctx.fns.gmail.list({ query: "is:unread", max: 10 })
export default async function (ctx: Context, session: Session | null, opts?: { query?: string; q?: string; max?: number; account?: string }) {
    const q = encodeURIComponent(opts?.query ?? opts?.q ?? "is:unread");
    const list = await ctx.fns.gmail.api({ path: `/messages?q=${q}&maxResults=${opts?.max ?? 20}`, account: opts?.account });
    const ids: string[] = list?.messages?.map((m: any) => m.id) ?? [];
    const headerVal = (h: any[], name: string) => h?.find((x: any) => x.name.toLowerCase() === name.toLowerCase())?.value;
    const messages: any[] = [];
    for (let i = 0; i < ids.length; i += 10) {
        const results = await Promise.all(ids.slice(i, i + 10).map(async id => {
            const msg = await ctx.fns.gmail.api({
                path: `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
                account: opts?.account,
            });
            const h = msg?.payload?.headers;
            return {
                id, threadId: msg.threadId,
                from: headerVal(h, "From"), to: headerVal(h, "To"),
                subject: headerVal(h, "Subject"), date: headerVal(h, "Date"),
                snippet: msg.snippet, labelIds: msg.labelIds,
            };
        }));
        messages.push(...results);
    }
    return messages;
}
