// gcs.remove — delete an object. ctx.fns.gcs.remove({ bucket, object }) -> true
export default async function (ctx: Context, session: Session | null, opts: { bucket: string; object: string }) {
    if (!opts?.bucket || !opts?.object) throw new Error("bucket and object are required");
    await ctx.fns.gcs.api({ route: "DELETE /b/{bucket}/o/{object}", params: { bucket: opts.bucket, object: opts.object } });
    return true;
}
