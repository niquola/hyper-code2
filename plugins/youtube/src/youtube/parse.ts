// Parse a YouTube URL into { type, id }.
// type: "video" | "playlist" | "channel" | "handle" | "unknown"
// ctx.fns.youtube.parse({ url: "https://youtu.be/dQw4w9WgXcQ" })
/**
 * Parses a YouTube URL into its resource type and identifier.
 */
export default async function (ctx: Context, session: Session | null, opts: {
  /** YouTube URL to parse. */
  url: string }) {
    try {
        const u = new URL(opts.url);
        if (u.hostname === "youtu.be") {
            return { type: "video", id: u.pathname.slice(1).split("?")[0] };
        }
        if (u.hostname.includes("youtube.com")) {
            const videoId = u.searchParams.get("v");
            if (videoId) return { type: "video", id: videoId };

            const m = u.pathname.match(/^\/(embed|v|shorts)\/([^/?]+)/);
            if (m) return { type: "video", id: m[2] };

            const listId = u.searchParams.get("list");
            if (listId && u.pathname === "/playlist") return { type: "playlist", id: listId };

            const channelMatch = u.pathname.match(/^\/channel\/([^/?]+)/);
            if (channelMatch) return { type: "channel", id: channelMatch[1] };

            const handleMatch = u.pathname.match(/^\/@([^/?]+)/);
            if (handleMatch) return { type: "handle", id: handleMatch[1] };
        }
    } catch {}
    return { type: "unknown", id: null as string | null };
}
