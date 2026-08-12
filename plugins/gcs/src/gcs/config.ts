// gcs.config — default GCP project + the two personal buckets.
// Named exports are imported by sibling fns (buckets/put/get/…); the default
// export lets you inspect them live: ctx.fns.gcs.config({}).
export const PROJECT = "atomic-ehr";
export const PRIVATE_BUCKET = "niquola-private";
export const PUBLIC_BUCKET = "niquola-public";

export default async function (ctx: Context, session: Session | null, opts?: {}) {
    return { project: PROJECT, private: PRIVATE_BUCKET, public: PUBLIC_BUCKET };
}
