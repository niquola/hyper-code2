// Generic Google Places API (New) call. The key stays private in 1Password.
export default async function (ctx: Context, _session: Session | null, opts: {
    path: string; method?: string; body?: object; fieldMask?: string; lang?: string;
}) {
    if (!opts?.path || !opts.path.startsWith("/")) throw new Error("gplaces.api: path must start with /");
    const cache = ((ctx.state as any).gplaces ??= {} as { apiKey?: string });
    const apiKey = cache.apiKey ?? ctx.env.GOOGLE_PLACES_API_KEY ?? await ctx.fns.secrets.resolve({ ref: "op://hyper/gplaces api_key.txt/value" });
    if (!apiKey) throw new Error("Google Places API key is not configured");
    cache.apiKey = apiKey;

    const headers: Record<string, string> = { "X-Goog-Api-Key": apiKey };
    if (opts.body) headers["Content-Type"] = "application/json";
    if (opts.fieldMask) headers["X-Goog-FieldMask"] = opts.fieldMask;
    if (opts.lang) headers["Accept-Language"] = opts.lang;
    const res = await fetch(`https://places.googleapis.com/v1${opts.path}`, {
        method: opts.method ?? "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let json: any;
    try { json = text ? JSON.parse(text) : null; }
    catch { throw new Error(`Places API ${res.status}: non-JSON response`); }
    if (!res.ok) throw new Error(`Places API ${res.status}: ${json?.error?.message ?? "request failed"}`);
    return json;
}
