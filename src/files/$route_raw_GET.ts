import { stat } from "node:fs/promises";
import { extname } from "node:path";

// GET /files/raw?path=... — stream a file for browser-native media previews.
/** Handles the corresponding HTTP route. */
export default async function (ctx: Context, _session: Session | null, opts: { /** Incoming HTTP request. */ req: Request }) {
    const url = new URL(opts.req.url);
    const path = url.searchParams.get("path") ?? "";
    const abs = ctx.fns.files.resolveSafe({ path });
    const info = await stat(abs).catch(() => null);
    if (!info?.isFile()) return new Response("not found", { status: 404 });

    const file = Bun.file(abs);
    const type = MIME[extname(abs).slice(1).toLowerCase()] || file.type || "application/octet-stream";
    return new Response(file, {
        headers: {
            "content-type": type,
            "content-length": String(info.size),
            "cache-control": "private, max-age=0, must-revalidate",
            "x-content-type-options": "nosniff",
        },
    });
}

const MIME: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
    webp: "image/webp", avif: "image/avif", svg: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/x-m4v", ogv: "video/ogg",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", m4a: "audio/mp4",
    aac: "audio/aac", flac: "audio/flac", opus: "audio/opus", pdf: "application/pdf",
};
