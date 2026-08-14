/**
 * gcs.upload — upload to a bucket (simple media upload).
 *   ctx.fns.gcs.upload({ bucket, object, content: "hi", contentType: "text/plain" })
 *   ctx.fns.gcs.upload({ bucket, object, file: "/path/local.pdf" })  // reads local file
 * content may be a string, Uint8Array, or (for JSON) a plain object -> stringified.
 * Returns the object resource. Prefer gcs.put/{putJson} for the personal buckets.
 */
const UPLOAD_BASE = "https://storage.googleapis.com/upload/storage/v1";

async function accessToken(ctx: Context) {
    const cache = ((ctx.state as any).gcs ??= {} as { token?: string; expiry?: number });
    if (cache.token && Date.now() < (cache.expiry ?? 0)) return cache.token;
    if (ctx.env.GOOGLE_ACCESS_TOKEN) { cache.token = ctx.env.GOOGLE_ACCESS_TOKEN; cache.expiry = Date.now() + 3_500_000; return cache.token; }
    const proc = Bun.spawn(["gcloud", "auth", "print-access-token"], { stdout: "pipe", stderr: "pipe" });
    const [stdout, _stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    const token = stdout.trim();
    if (code !== 0 || !token) throw new Error("No GCP token. Run `gcloud auth login` or set GOOGLE_ACCESS_TOKEN.");
    cache.token = token; cache.expiry = Date.now() + 3_500_000; return token;
}

/**
 * Uploads content to a Google Cloud Storage bucket.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param opts Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, session: Session | null, opts: {
        /** Bucket name. */
        bucket: string;
        /** Object name. */
        object: string;
        /** Content to upload or message content. */
        content?: string | Uint8Array | object;
        /** Local file path to upload. */
        file?: string;
        /** Request or object media type. */
        contentType?: string;
    }) {
    if (!opts?.bucket || !opts?.object) throw new Error("bucket and object are required");
    const token = await accessToken(ctx);

    let body: string | Uint8Array;
    let contentType = opts.contentType;
    if (opts.file != null) {
        const f = Bun.file(opts.file);
        if (!(await f.exists())) throw new Error(`No such file: ${opts.file}`);
        body = new Uint8Array(await f.arrayBuffer());
        contentType ??= f.type || "application/octet-stream";
    } else if (opts.content == null) {
        throw new Error("provide `content` or `file`");
    } else if (typeof opts.content === "string" || opts.content instanceof Uint8Array) {
        body = opts.content;
        contentType ??= typeof opts.content === "string" ? "text/plain; charset=utf-8" : "application/octet-stream";
    } else {
        body = JSON.stringify(opts.content);
        contentType ??= "application/json";
    }

    const url = `${UPLOAD_BASE}/b/${encodeURIComponent(opts.bucket)}/o?uploadType=media&name=${encodeURIComponent(opts.object)}`;
    const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType! },
        body,
    });
    if (!res.ok) throw new Error(`GCS upload ${res.status}: ${(await res.text()).slice(0, 500)}`);
    return res.json();
}
