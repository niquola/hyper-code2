// gcs.download — read an object's content.
//   ctx.fns.gcs.download({ bucket, object })                 -> text
//   ctx.fns.gcs.download({ bucket, object, as: "bytes" })    -> Uint8Array
//   ctx.fns.gcs.download({ bucket, object, as: "json" })     -> parsed JSON
//   ctx.fns.gcs.download({ bucket, object, path: "/out.pdf" })-> writes file, returns { path, bytes }
const BASE = "https://storage.googleapis.com/storage/v1";

async function accessToken(ctx: Context) {
    const cache = ((ctx.state as any).gcs ??= {} as { token?: string; expiry?: number });
    if (cache.token && Date.now() < (cache.expiry ?? 0)) return cache.token;
    if (ctx.env.GOOGLE_ACCESS_TOKEN) { cache.token = ctx.env.GOOGLE_ACCESS_TOKEN; cache.expiry = Date.now() + 3_500_000; return cache.token; }
    const proc = Bun.spawn(["gcloud", "auth", "print-access-token"], { stdout: "pipe", stderr: "pipe" });
    const [stdout, _stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
    const token = stdout.trim();
    if (code !== 0 || !token) throw new Error("No GCP token. Run `gcloud auth login` or set GOOGLE_ACCESS_TOKEN.");
    cache.token = token; cache.expiry = Date.now() + 3_500_000; return token;
}

export default async function (ctx: Context, session: Session | null, opts: {
    bucket: string;
    object: string;
    as?: "text" | "bytes" | "json";
    path?: string;
}) {
    if (!opts?.bucket || !opts?.object) throw new Error("bucket and object are required");
    const token = await accessToken(ctx);
    const url = `${BASE}/b/${encodeURIComponent(opts.bucket)}/o/${encodeURIComponent(opts.object)}?alt=media`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`GCS download ${res.status}: ${(await res.text()).slice(0, 500)}`);

    if (opts.path != null) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        await Bun.write(opts.path, bytes);
        return { path: opts.path, bytes: bytes.length };
    }
    if (opts.as === "bytes") return new Uint8Array(await res.arrayBuffer());
    if (opts.as === "json") return JSON.parse(await res.text());
    return res.text();
}
