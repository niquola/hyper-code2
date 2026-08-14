/**
 * gcs.remove — delete an object. ctx.fns.gcs.remove({ bucket, object }) -> true
 */
/**
 * Removes a Google Cloud Storage object.
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
    }) {
    if (!opts?.bucket || !opts?.object) throw new Error("bucket and object are required");
    await ctx.fns.gcs.api({ route: "DELETE /b/{bucket}/o/{object}", params: { bucket: opts.bucket, object: opts.object } });
    return true;
}
