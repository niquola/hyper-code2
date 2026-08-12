// Video details by id(s) or URL. Accepts a single id/url or an array of ids.
// ctx.fns.youtube.video({ id: "dQw4w9WgXcQ" }) → object
// ctx.fns.youtube.video({ id: ["id1","id2"] }) → array
// A youtube.com / youtu.be URL is resolved via youtube.parse.
function dur(iso?: string): string {
    if (!iso) return "";
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return "";
    const s = (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
    const h = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
    return h > 0 ? `${h}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${mm}:${String(ss).padStart(2, "0")}`;
}
function count(n?: string): string | undefined {
    if (n === undefined) return undefined;
    const num = parseInt(n);
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return String(num);
}
function fmt(v: any) {
    const s = v.snippet, c = v.contentDetails, st = v.statistics;
    return {
        id: v.id,
        title: s.title,
        channel: s.channelTitle,
        channelId: s.channelId,
        duration: dur(c?.duration),
        definition: c?.definition,
        views: count(st?.viewCount),
        likes: count(st?.likeCount),
        comments: count(st?.commentCount),
        published: s.publishedAt?.split("T")[0],
        description: s.description?.slice(0, 500),
        tags: s.tags?.slice(0, 10),
        thumbnail: s.thumbnails?.maxres?.url || s.thumbnails?.high?.url,
        url: `https://youtube.com/watch?v=${v.id}`,
    };
}

export default async function (ctx: Context, session: Session | null, opts: { id: string | string[] }) {
    const raw = Array.isArray(opts.id) ? opts.id : [opts.id];
    const ids = await Promise.all(raw.map(async (x) => {
        if (typeof x === "string" && (x.includes("youtube.com") || x.includes("youtu.be"))) {
            const p = await ctx.fns.youtube.parse({ url: x });
            if (p.type === "video" && p.id) return p.id;
            throw new Error(`Not a video URL: ${x}`);
        }
        return x;
    }));
    const data = await ctx.fns.youtube.api({
        endpoint: "videos",
        params: { id: ids.join(","), part: "snippet,contentDetails,statistics" },
    });
    const items: any[] = (data.items ?? []).map(fmt);
    return Array.isArray(opts.id) ? items : (items[0] ?? null);
}
