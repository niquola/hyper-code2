// Generic YouTube Data API v3 GET. The API key stays in 1Password and is
// injected here; there is intentionally no public key() function.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { endpoint: string; params?: Record<string, string | number | undefined> },
) {
    if (!opts?.endpoint || !/^[a-zA-Z0-9_-]+$/.test(opts.endpoint)) throw new Error("youtube.api: valid endpoint required");
    const cache = ((ctx.state as any).youtube ??= {} as { key?: string });
    const key = cache.key ?? ctx.env.YOUTUBE_API_KEY ?? await ctx.fns.secrets.resolve({ ref: "op://hyper/youtube api_key.txt/value" });
    if (!key) throw new Error("YouTube API key is not configured");
    cache.key = key;

    const search = new URLSearchParams({ key });
    for (const [name, value] of Object.entries(opts.params ?? {})) {
        if (value !== undefined && value !== "") search.set(name, String(value));
    }
    const res = await fetch(`https://www.googleapis.com/youtube/v3/${opts.endpoint}?${search}`);
    const text = await res.text();
    let json: any;
    try { json = text ? JSON.parse(text) : null; }
    catch { throw new Error(`YouTube API ${res.status} on ${opts.endpoint}: non-JSON response`); }
    if (!res.ok) throw new Error(`YouTube API ${res.status} on ${opts.endpoint}: ${json?.error?.message ?? "request failed"}`);
    return json;
}
