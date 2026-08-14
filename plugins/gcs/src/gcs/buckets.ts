/**
 * gcs.buckets — list buckets in a project. ctx.fns.gcs.buckets({ project?: "atomic-ehr" })
 * Defaults project to gcs.PROJECT (atomic-ehr). Returns bucket resources (items).
 */
const PROJECT = "atomic-ehr";

/**
 * Lists Google Cloud Storage buckets.
 *
 * @param ctx Runtime context.
 * @param session Active session, when available.
 * @param [opts] Operation options.
 * @returns The operation result.
 */
export default async function (ctx: Context, session: Session | null, opts?: {
        /** Google Cloud project identifier. */
        project?: string;
    }) {
    const project = opts?.project ?? PROJECT;
    const res = await ctx.fns.gcs.api({ route: "GET /b", query: { project } });
    return res?.items ?? [];
}
