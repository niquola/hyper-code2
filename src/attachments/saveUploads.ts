/**
 * Persist uploaded chat files and return compact attachment references
 *
 * Validates and stores browser-uploaded files in content-addressed runtime storage and extracts bounded PDF or text content. Use only at the chat HTTP ingress before committing refs to a message.
 * @param opts.agentId Agent that owns the uploaded turn.
 * @param opts.files Browser multipart files to validate and persist.
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Agent that owns the uploaded turn. */
        agentId: string;
        /** Browser multipart files to validate and persist. */
        files: File[];
    },
): Promise<Array<{ ref: types.tools.Content; pending: Record<string, any>; meta: { id: string; fileName: string; mimeType: string; size: number; kind: string } }>> {
    const { mkdir } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const { createHash } = await import("node:crypto");
    if (!Array.isArray(opts.files) || opts.files.length === 0) return [];
    if (opts.files.length > 10) throw new Error("maximum 10 files per message");
    let total = 0;
    const root = resolve(String((ctx.state as any).root ?? process.cwd()), ".runtime", "uploads", "blobs");
    await mkdir(root, { recursive: true });
    const out: any[] = [];
    for (const file of opts.files) {
        if (!(file instanceof File) || file.size <= 0) continue;
        total += file.size;
        if (file.size > 25 * 1024 * 1024) throw new Error(`file too large: ${file.name}`);
        if (total > 50 * 1024 * 1024) throw new Error("attachments exceed 50 MB");
        const bytes = new Uint8Array(await file.arrayBuffer());
        const head = Buffer.from(bytes.subarray(0, 16));
        let magic: string | null = null;
        if (head.subarray(0, 5).toString() === "%PDF-") magic = "application/pdf";
        else if (head.length >= 8 && head[0] === 0x89 && head.subarray(1, 4).toString() === "PNG") magic = "image/png";
        else if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) magic = "image/jpeg";
        else if (head.subarray(0, 4).toString() === "GIF8") magic = "image/gif";
        else if (head.subarray(0, 4).toString() === "RIFF" && head.subarray(8, 12).toString() === "WEBP") magic = "image/webp";
        const declared = String(file.type || "application/octet-stream").split(";")[0]!.toLowerCase();
        const textLike = declared.startsWith("text/") || /\.(txt|md|json|xml|html|css|js|ts|tsx|jsx|yml|yaml|csv|log)$/i.test(file.name);
        const mimeType = magic ?? (textLike ? (declared.startsWith("text/") ? declared : "text/plain") : "application/octet-stream");
        const kind = magic?.startsWith("image/") ? "image" : magic === "application/pdf" ? "pdf" : "file";
        const hash = createHash("sha256").update(bytes).digest("hex");
        const storagePath = resolve(root, hash + (kind === "pdf" ? ".pdf" : kind === "image" ? ".img" : ".bin"));
        if (!await Bun.file(storagePath).exists()) await Bun.write(storagePath, bytes);
        let extractedText: string | null = null;
        if (kind === "pdf") { try { const proc = Bun.spawn(["pdftotext", "-layout", storagePath, "-"], { stdout: "pipe", stderr: "pipe" }); const [text, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]); if (code === 0 && text.trim()) extractedText = text.slice(0, 200_000); } catch {} }
        else if (textLike && bytes.length <= 2 * 1024 * 1024) extractedText = new TextDecoder().decode(bytes).slice(0, 200_000);
        const id = crypto.randomUUID();
        const fileName = String(file.name || "attachment").replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 240);
        const ref: types.tools.Content = kind === "image" ? { type: "image_ref", attachmentId: id, fileName, mimeType, size: file.size } : { type: "document_ref", attachmentId: id, fileName, mimeType, size: file.size };
        out.push({ ref, pending: { hash, storagePath, kind, extractedText }, meta: { id, fileName, mimeType, size: file.size, kind } });
    }
    return out;
}
