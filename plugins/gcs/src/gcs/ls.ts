// gcs.ls — list object names in a personal bucket (niquola-private / niquola-public).
//   ctx.fns.gcs.ls({})                              // all private objects
//   ctx.fns.gcs.ls({ scope: "public", prefix: "reports/" })
// Returns [{ name, size, updated, contentType, url }].
const PRIVATE_BUCKET = "niquola-private";
const PUBLIC_BUCKET = "niquola-public";

export default async function (ctx: Context, session: Session | null, opts?: {
    scope?: "private" | "public";
    prefix?: string;
}) {
    const isPublic = opts?.scope === "public";
    const bucket = isPublic ? PUBLIC_BUCKET : PRIVATE_BUCKET;
    const items = await ctx.fns.gcs.objects({ bucket, prefix: opts?.prefix, all: true });
    return items.map((o: any) => ({
        name: o.name,
        size: Number(o.size ?? 0),
        updated: o.updated,
        contentType: o.contentType,
        url: isPublic
            ? `https://storage.googleapis.com/${bucket}/${String(o.name).split("/").map(encodeURIComponent).join("/")}`
            : `gs://${bucket}/${o.name}`,
    }));
}
