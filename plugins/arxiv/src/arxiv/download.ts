import { dirname } from "node:path";

/** Downloads an arXiv PDF, source archive, or both into the current workspace. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** arXiv paper ID. */
        id: string;
        /** Artifact kind. @default "pdf" */
        format?: "pdf" | "source" | "both";
        /** Workspace-relative or absolute output directory. @default "arxiv" */
        dir?: string;
        /** Exact output path; valid only for one format. */
        path?: string;
    },
): Promise<{ saved: Array<{ kind: "pdf" | "source"; path: string; size: number }> }> {
    const id = String(opts?.id ?? "").trim().replace(/^arXiv:/i, "");
    if (!id) throw new Error("arxiv.download: id is required");
    const format = opts.format ?? "pdf";
    if (opts.path && format === "both") throw new Error("arxiv.download: path cannot be used with format both");
    const safeId = id.replace(/\//g, "_");
    const root = ctx.fns.workspace.resolve({ path: opts.dir ?? "arxiv" });
    const saved: Array<{ kind: "pdf" | "source"; path: string; size: number }> = [];

    const download = async (kind: "pdf" | "source", url: string, fallback: string) => {
        const response = await fetch(url, { headers: { "user-agent": "hyper-code2-arxiv/1.0 (+local research client)" } });
        if (!response.ok) throw new Error(`arxiv.download: ${response.status} ${response.statusText}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        const path = opts.path ? ctx.fns.workspace.resolve({ path: opts.path }) : fallback;
        await ctx.fns.files.mkdir({ path: dirname(path) });
        await Bun.write(path, bytes);
        saved.push({ kind, path, size: bytes.byteLength });
    };
    if (format === "pdf" || format === "both") await download("pdf", `https://arxiv.org/pdf/${id}.pdf`, `${root}/${safeId}/pdf/${safeId}.pdf`);
    if (format === "source" || format === "both") await download("source", `https://arxiv.org/e-print/${id}`, `${root}/${safeId}/source/${safeId}.tar.gz`);
    return { saved };
}
