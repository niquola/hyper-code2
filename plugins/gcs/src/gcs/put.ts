/**
 * gcs.put — upload to one of the personal buckets (niquola-private / niquola-public).
 *   ctx.fns.gcs.put({ object: "notes/a.md", content: "# hi" })          // -> private
 *   ctx.fns.gcs.put({ object: "x.json", content: {a:1}, scope: "public" })
 *   ctx.fns.gcs.put({ object: "doc.pdf", file: "/tmp/doc.pdf", scope: "public" })
 * scope defaults to "private". Returns { bucket, object, url } — url is the public
 * https URL for scope:"public", else the gs:// URI.
 */
const PRIVATE_BUCKET = "niquola-private";
const PUBLIC_BUCKET = "niquola-public";

/**
 * Uploads content to a configured personal bucket.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param opts Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, session: Session | null, opts: {
        /** Object name. */
        object: string;
        /** Content to upload or message content. */
        content?: string | Uint8Array | object;
        /** Local file path to upload. */
        file?: string;
        /** Configured bucket scope. */
        scope?: "private" | "public";
        /** Request or object media type. */
        contentType?: string;
    }) {
    if (!opts?.object) throw new Error("object is required");
    const isPublic = opts.scope === "public";
    const bucket = isPublic ? PUBLIC_BUCKET : PRIVATE_BUCKET;
    await ctx.fns.gcs.upload({
        bucket, object: opts.object,
        content: opts.content, file: opts.file, contentType: opts.contentType,
    });
    const url = isPublic
        ? `https://storage.googleapis.com/${bucket}/${opts.object.split("/").map(encodeURIComponent).join("/")}`
        : `gs://${bucket}/${opts.object}`;
    return { bucket, object: opts.object, url };
}
