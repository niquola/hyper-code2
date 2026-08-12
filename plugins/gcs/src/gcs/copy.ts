// gcs.copy — copy (or move) an object between buckets/names.
//   ctx.fns.gcs.copy({ srcBucket, srcObject, dstBucket, dstObject })
//   ctx.fns.gcs.copy({ ..., move: true })  // copy then delete the source
export default async function (ctx: Context, session: Session | null, opts: {
    srcBucket: string; srcObject: string;
    dstBucket: string; dstObject: string;
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
