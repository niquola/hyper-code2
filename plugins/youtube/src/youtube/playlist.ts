// List videos in a playlist (by id or URL), enriched with full video details.
// ctx.fns.youtube.playlist({ id: "PLRqwX-V7Uu6ZF9C0YMKuns9sLDzK6zoiV", max: 20 })
/**
 * Fetches metadata and videos from a YouTube playlist.
 */
export default async function (ctx: Context, session: Session | null, opts: {
  /** YouTube playlist identifier or URL. */
  id: string;
  /** Maximum number of playlist items to return. */
  max?: number }) {
    let playlistId = opts.id;
    if (playlistId.includes("youtube.com")) {
        const p = await ctx.fns.youtube.parse({ url: playlistId });
        if (p.type === "playlist" && p.id) playlistId = p.id;
        else throw new Error(`Could not parse playlist URL: ${opts.id}`);
    }

    const data = await ctx.fns.youtube.api({
        endpoint: "playlistItems",
        params: { playlistId, part: "snippet", maxResults: Math.min(opts.max ?? 25, 50) },
    });
    const items: any[] = data.items ?? [];
    const videoIds = items.map((i) => i.snippet?.resourceId?.videoId).filter(Boolean) as string[];
    if (!videoIds.length) return [];
    return await ctx.fns.youtube.video({ id: videoIds });
}
