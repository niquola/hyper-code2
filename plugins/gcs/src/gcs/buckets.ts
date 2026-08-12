// gcs.buckets — list buckets in a project. ctx.fns.gcs.buckets({ project?: "atomic-ehr" })
// Defaults project to gcs.PROJECT (atomic-ehr). Returns bucket resources (items).
const PROJECT = "atomic-ehr";

export default async function (ctx: Context, session: Session | null, opts?: { project?: string }) {
    const project = opts?.project ?? PROJECT;
    const res = await ctx.fns.gcs.api({ route: "GET /b", query: { project } });
    return res?.items ?? [];
}
