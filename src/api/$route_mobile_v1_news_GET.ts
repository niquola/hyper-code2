/** Lists unread-first stored news for the native swipe reader. */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    const url = new URL(opts.req.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 30) || 30));
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
    const items = await ctx.fns.news.list({ limit, offset });
    return Response.json({ version: 1, items: items.map((item: any) => ({ id: String(item.id), title: item.title || "Untitled", source: item.source || "", url: item.url || null, author: item.author || null, summary: item.summary || item.summary_long || "", topics: item.topics || [], liked: item.liked_at != null, read: item.read_at != null, shownAt: item.shown_at || item.fetched_at || null })) });
}
