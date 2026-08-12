// gcs.get — read from one of the personal buckets (niquola-private / niquola-public).
//   ctx.fns.gcs.get({ object: "notes/a.md" })                    // -> text (private)
//   ctx.fns.gcs.get({ object: "x.json", as: "json", scope: "public" })
//   ctx.fns.gcs.get({ object: "doc.pdf", path: "/tmp/doc.pdf" }) // -> { path, bytes }
// scope defaults to "private". Thin wrapper over gcs.download.
const PRIVATE_BUCKET = "niquola-private";
const PUBLIC_BUCKET = "niquola-public";

export default async function (ctx: Context, session: Session | null, opts: {
    object: string;
    scope?: "private" | "public";
    as?: "text" | "bytes" | "json";
    path?: string;
}) {
    if (!opts?.object) throw new Error("object is required");
    const bucket = opts.scope === "public" ? PUBLIC_BUCKET : PRIVATE_BUCKET;
    return ctx.fns.gcs.download({ bucket, object: opts.object, as: opts.as, path: opts.path });
}
