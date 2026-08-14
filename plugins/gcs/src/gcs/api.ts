/**
 * gcs.api — call the GCS JSON API (Storage v1). Base: https://storage.googleapis.com/storage/v1
 *   ctx.fns.gcs.api({ route: "GET /b", query: { project: "atomic-ehr" } })
 *   ctx.fns.gcs.api({ route: "GET /b/{bucket}/o", params: { bucket: "niquola-public" } })
 *   ctx.fns.gcs.api({ route: "DELETE /b/{bucket}/o/{object}", params: { bucket, object } })
 * route: "<METHOD> <path>" (path {name} filled from params, encodeURIComponent'd).
 * A full https:// path hits any Google API. Returns parsed JSON (null on 204).
 */
const BASE = "https://storage.googleapis.com/storage/v1";

async function accessToken(ctx: Context) {
    const cache = ((ctx.state as any).gcs ??= {} as { token?: string; expiry?: number });
    if (cache.token && Date.now() < (cache.expiry ?? 0)) return cache.token;
    if (ctx.env.GOOGLE_ACCESS_TOKEN) {
        cache.token = ctx.env.GOOGLE_ACCESS_TOKEN; cache.expiry = Date.now() + 3_500_000; return cache.token;
    }
    const proc = Bun.spawn(["gcloud", "auth", "print-access-token"], { stdout: "pipe", stderr: "pipe" });
    const [stdout, _stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    const token = stdout.trim();
    if (code !== 0 || !token) throw new Error("No GCP token. Run `gcloud auth login` or set GOOGLE_ACCESS_TOKEN.");
    cache.token = token; cache.expiry = Date.now() + 3_500_000; return token;
}

/**
 * Performs an authenticated Google Cloud Storage API request.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param opts Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, session: Session | null, opts: {
        /** Google Cloud Storage API route. */
        route: string;
        /** Route parameters. */
        params?: Record<string, string | number | boolean>;
        /** Search query. */
        query?: Record<string, string | number | boolean>;
        /** JSON request body. */
        body?: any;
        /** Raw request body. */
        rawBody?: Uint8Array | Blob | string;
        /** Request or object media type. */
        contentType?: string;
        /** Additional HTTP headers. */
        headers?: Record<string, string>;
    }) {
    const token = await accessToken(ctx);

    const spaceIdx = opts.route.indexOf(" ");
    const method = spaceIdx > 0 ? opts.route.slice(0, spaceIdx) : "GET";
    let path = spaceIdx > 0 ? opts.route.slice(spaceIdx + 1) : opts.route;

    if (opts.params) {
        for (const [k, v] of Object.entries(opts.params)) {
            path = path.replace(`{${k}}`, encodeURIComponent(String(v)));
        }
    }

    const url = new URL(path.startsWith("http") ? path : `${BASE}${path}`);
    if (opts.query) for (const [k, v] of Object.entries(opts.query)) url.searchParams.set(k, String(v));

    const res = await fetch(url.toString(), {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(opts.body ? { "Content-Type": "application/json" } : {}),
            ...(opts.contentType ? { "Content-Type": opts.contentType } : {}),
            ...opts.headers,
        },
        body: opts.rawBody ?? (opts.body ? JSON.stringify(opts.body) : undefined),
    });

    if (res.status === 204) return null;
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(`GCS API ${res.status}: ${JSON.stringify(json)?.slice(0, 500)}`);
    return json;
}
