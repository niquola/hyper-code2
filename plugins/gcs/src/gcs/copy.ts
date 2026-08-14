/**
 * gcs.copy — copy (or move) an object between buckets/names.
 *   ctx.fns.gcs.copy({ srcBucket, srcObject, dstBucket, dstObject })
 *   ctx.fns.gcs.copy({ ..., move: true })  // copy then delete the source
 */
/**
 * Copies or moves a Google Cloud Storage object.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param opts Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, session: Session | null, opts: {
        /** Source bucket name. */
        srcBucket: string;
        /** Source object name. */
        srcObject: string;
        /** Destination bucket name. */
        dstBucket: string;
        /** Destination object name. */
        dstObject: string;
        /** Whether to delete the source after copying. */
        move?: boolean;
    }) {
    const { srcBucket, srcObject, dstBucket, dstObject } = opts ?? ({} as any);
    if (!srcBucket || !srcObject || !dstBucket || !dstObject)
        throw new Error("srcBucket, srcObject, dstBucket, dstObject are required");
    const res = await ctx.fns.gcs.api({
        route: "POST /b/{srcBucket}/o/{srcObject}/copyTo/b/{dstBucket}/o/{dstObject}",
        params: { srcBucket, srcObject, dstBucket, dstObject },
    });
    if (opts.move) await ctx.fns.gcs.remove({ bucket: srcBucket, object: srcObject });
    return res;
}
