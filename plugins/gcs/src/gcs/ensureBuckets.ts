// gcs.ensureBuckets — create the two personal buckets if missing.
//   ctx.fns.gcs.ensureBuckets({})            // create both if absent
//   ctx.fns.gcs.ensureBuckets({ location: "EU" })
// Both use uniform bucket-level access. The public bucket gets an allUsers ->
// objectViewer IAM binding so objects are world-readable via their https URL.
// Returns a per-bucket status. Idempotent.
const PROJECT = "atomic-ehr";
const PRIVATE_BUCKET = "niquola-private";
const PUBLIC_BUCKET = "niquola-public";

async function ensureOne(ctx: Context, name: string, isPublic: boolean, project: string, location: string) {
    let created = false;
    let exists: any = null;
    try {
        exists = await ctx.fns.gcs.api({ route: "GET /b/{bucket}", params: { bucket: name } });
    } catch (e: any) {
        if (!/ 40[34]:/.test(String(e?.message))) throw e; // 404 not found / 403 no access
    }
    if (!exists) {
        await ctx.fns.gcs.api({
            route: "POST /b",
            query: { project },
            body: {
                name,
                location,
                storageClass: "STANDARD",
                iamConfiguration: { uniformBucketLevelAccess: { enabled: true } },
            },
        });
        created = true;
    }
    if (isPublic) {
        // Add allUsers -> roles/storage.objectViewer (merge into existing policy).
        const policy = await ctx.fns.gcs.api({ route: "GET /b/{bucket}/iam", params: { bucket: name } });
        const bindings = policy.bindings ?? [];
        let b = bindings.find((x: any) => x.role === "roles/storage.objectViewer");
        if (!b) { b = { role: "roles/storage.objectViewer", members: [] }; bindings.push(b); }
        if (!b.members.includes("allUsers")) {
            b.members.push("allUsers");
            await ctx.fns.gcs.api({
                route: "PUT /b/{bucket}/iam",
                params: { bucket: name },
                body: { ...policy, bindings },
            });
        }
    }
    return { bucket: name, created, public: isPublic };
}

export default async function (ctx: Context, session: Session | null, opts?: { project?: string; location?: string }) {
    const project = opts?.project ?? PROJECT;
    const location = opts?.location ?? "US";
    return {
        private: await ensureOne(ctx, PRIVATE_BUCKET, false, project, location),
        public: await ensureOne(ctx, PUBLIC_BUCKET, true, project, location),
    };
}
