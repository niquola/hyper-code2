/**
 * Builds an HTTP response that streams a filesystem file with its browser MIME type
 *
 * Use from Files HTTP routes and middleware when a binary or text asset must be served without UTF-8 decoding. It validates that the path is an existing regular file and supplies private revalidation and nosniff headers.
 * @param opts.path Relative or absolute filesystem path to stream.
 * @param opts.method HTTP method; HEAD returns headers without a response body. @default GET
 */
export default async function (
    ctx: Context,
    session: Session | null,
    opts: {
        /** Relative or absolute filesystem path to stream. */
        path: string;
        /** HTTP method; HEAD returns headers without a response body. @default GET */
        method?: string;
    },
): Promise<Response> {
    const { stat } = await import("node:fs/promises");
    const { extname } = await import("node:path");
    const absolute = ctx.fns.files.resolveSafe({ path: opts.path });
    const info = await stat(absolute).catch(() => null);
    if (!info?.isFile()) return new Response("not found", { status: 404 });
    const file = Bun.file(absolute);
    const mime: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", svg: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon",
      mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/x-m4v", ogv: "video/ogg", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac", opus: "audio/opus",
      pdf: "application/pdf", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8", json: "application/json; charset=utf-8", html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8", txt: "text/plain; charset=utf-8", xml: "application/xml; charset=utf-8", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf"
    };
    const type = mime[extname(absolute).slice(1).toLowerCase()] || file.type || "application/octet-stream";
    return new Response((opts.method ?? "GET").toUpperCase() === "HEAD" ? null : file, { headers: { "content-type": type, "content-length": String(info.size), "cache-control": "private, max-age=0, must-revalidate", "x-content-type-options": "nosniff" } });
}
