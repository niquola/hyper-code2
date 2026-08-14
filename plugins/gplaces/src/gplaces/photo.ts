// Download a Google Places photo without exposing the API key in a returned URL.
// `name` is a photo resource name returned by details().photos.
/**
 * Downloads a Google Places photo.
 */
export default async function (ctx: Context, _session: Session | null, opts: {
        /** Google Places photo resource name. */
        name: string;
  /** Maximum output width in pixels. */
  maxWidth?: number;
  /** Destination file path. */
  path?: string;
}) {
    if (!opts?.name || !/^places\/[^/]+\/photos\/[^/]+$/.test(opts.name)) throw new Error("valid photo resource name is required");
    const cache = ((ctx.state as any).gplaces ??= {} as { apiKey?: string });
    const apiKey = cache.apiKey ?? ctx.env.GOOGLE_PLACES_API_KEY ?? await ctx.fns.secrets.resolve({ ref: "op://hyper/gplaces api_key.txt/value" });
    if (!apiKey) throw new Error("Google Places API key is not configured");
    cache.apiKey = apiKey;
    const width = Math.max(1, Math.min(4800, opts.maxWidth ?? 800));
    const res = await fetch(`https://places.googleapis.com/v1/${opts.name}/media?maxWidthPx=${width}&key=${encodeURIComponent(apiKey)}`);
    if (!res.ok) throw new Error(`Places photo ${res.status}: download failed`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const path = opts.path ?? `/tmp/gplaces-${Date.now()}.jpg`;
    await Bun.write(path, bytes);
    return { path, bytes: bytes.length, contentType: res.headers.get("content-type") ?? "image/jpeg" };
}
