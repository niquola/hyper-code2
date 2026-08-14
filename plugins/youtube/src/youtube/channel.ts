// Channel info by id (UC...), @handle, or URL.
// ctx.fns.youtube.channel({ id: "@Google" })
// ctx.fns.youtube.channel({ id: "UCVHFbqXqoYvEWM1Ddxl0QDg" })
/**
 * Formats a numeric count using compact K/M suffixes.
 *
 * @param n - Decimal count returned by YouTube, if available.
 * @returns Compact count or undefined when absent.
 */
function count(n?: string): string | undefined {
    if (n === undefined) return undefined;
    const num = parseInt(n);
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return String(num);
}

/**
 * Fetches metadata for a YouTube channel.
 */
export default async function (ctx: Context, session: Session | null, opts: {
  /** YouTube channel identifier, handle, or URL. */
  id: string }) {
    let arg = opts.id;
    if (arg.includes("youtube.com")) {
        const p = await ctx.fns.youtube.parse({ url: arg });
        if (p.type === "channel" && p.id) arg = p.id;
        else if (p.type === "handle" && p.id) arg = `@${p.id}`;
        else throw new Error(`Could not parse channel URL: ${opts.id}`);
    }

    const params: Record<string, string> = { part: "snippet,statistics" };
    if (arg.startsWith("@")) params.forHandle = arg.replace(/^@/, "");
    else params.id = arg;

    const data = await ctx.fns.youtube.api({ endpoint: "channels", params });
    const ch = data.items?.[0];
    if (!ch) return null;
    const s = ch.snippet, st = ch.statistics;
    return {
        id: ch.id,
        title: s.title,
        handle: s.customUrl,
        subscribers: count(st?.subscriberCount),
        videos: count(st?.videoCount),
        views: count(st?.viewCount),
        description: s.description?.slice(0, 300),
        country: s.country,
        url: `https://youtube.com/channel/${ch.id}`,
    };
}
