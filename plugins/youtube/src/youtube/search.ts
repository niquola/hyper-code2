// Search YouTube. Default type "video"; for video results it enriches each hit
// with full stats (views/duration/likes) via youtube.video.
// ctx.fns.youtube.search({ query: "bun javascript runtime", max: 3 })
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        query: string;
        max?: number;
        type?: "video" | "channel" | "playlist";
        order?: "date" | "rating" | "relevance" | "viewCount";
        channelId?: string;
        duration?: "short" | "medium" | "long";
    }
) {
    const data = await ctx.fns.youtube.api({
        endpoint: "search",
        params: {
            q: opts.query,
            part: "snippet",
            type: opts.type ?? "video",
            order: opts.order ?? "relevance",
            maxResults: Math.min(opts.max ?? 10, 50),
            channelId: opts.channelId,
            videoDuration: opts.duration,
        },
    });
    const results: any[] = data.items ?? [];

    const videoIds = results.filter((r) => r.id?.videoId).map((r) => r.id.videoId as string);
    let videoMap = new Map<string, any>();
    if (videoIds.length) {
        const videos = await ctx.fns.youtube.video({ id: videoIds });
        videoMap = new Map(videos.map((v: any) => [v.id, v]));
    }

    return results.map((r) => {
        const vid = r.id?.videoId, cid = r.id?.channelId, pid = r.id?.playlistId;
        if (vid && videoMap.has(vid)) return videoMap.get(vid);
        const s = r.snippet;
        return {
            type: vid ? "video" : cid ? "channel" : "playlist",
            id: vid || cid || pid,
            title: s.title,
            channel: s.channelTitle,
            channelId: s.channelId,
            published: s.publishedAt?.split("T")[0],
            url: vid
                ? `https://youtube.com/watch?v=${vid}`
                : cid
                ? `https://youtube.com/channel/${cid}`
                : `https://youtube.com/playlist?list=${pid}`,
        };
    });
}
