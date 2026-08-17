import { stat } from "node:fs/promises";

// Path-based Files URLs make the filesystem hierarchy visible to the browser:
// /files/absolute/Users/me/project/docs/readme.md. A request for an existing
// file renders the Files page; a relative asset request under that URL streams
// the file itself, so Markdown images and HTML/CSS resources work naturally.
/**
 * Serves path-based Files UI pages and relative assets under `/files/absolute`.
 * Use the canonical URL produced by `files.browserUrl`; this middleware handles
 * any number of path segments because ordinary runtime routes match fixed arity.
 * @param opts.req Incoming GET or HEAD request below `/files/absolute`.
 */
export default async function (ctx: Context, _session: Session | null, opts: { req: Request; params: Record<string, string> }) {
    if (opts.req.method !== "GET" && opts.req.method !== "HEAD") return;
    const url = new URL(opts.req.url);
    const prefix = "/files/absolute";
    if (url.pathname !== prefix && !url.pathname.startsWith(prefix + "/")) return;

    let decoded: string;
    try {
        decoded = decodeURIComponent(url.pathname.slice(prefix.length));
    } catch {
        return new Response("bad path", { status: 400 });
    }
    const absolute = decoded.startsWith("/") ? decoded : "/" + decoded;
    const info = await stat(absolute).catch(() => null);
    if (!info) return new Response("not found", { status: 404 });

    if (info.isDirectory() || url.searchParams.has("tab") || isPageRequest(opts.req, absolute)) {
        const target = new URL("/files", url.origin);
        target.searchParams.set("path", absolute);
        const tab = url.searchParams.get("tab");
        if (tab) target.searchParams.set("tab", tab);
        const headers: Record<string, string> = {};
        for (const name of ["accept", "hx-request", "x-hyper-fragment"]) {
            const value = opts.req.headers.get(name);
            if (value) headers[name] = value;
        }
        return ctx.fns.procs.http.dispatch({ url: target.pathname + target.search, method: opts.req.method, headers });
    }

    return ctx.fns.files.rawResponse({ path: absolute, method: opts.req.method });
}

function isPageRequest(req: Request, path: string): boolean {
    const accept = req.headers.get("accept") ?? "";
    if (accept.includes("text/html") || accept === "" || accept === "*/*") return true;
    // Browser address-bar requests commonly send */*. Keep known document
    // extensions navigable while assets requested by img/video/css stream raw.
    return /\.(?:md|markdown|txt|ts|tsx|js|jsx|mjs|cjs|json|ya?ml|toml|css|html?|xml|sql|py|rs|go|java|sh|bash|zsh|diff)$/i.test(path)
        && !accept.startsWith("image/") && !accept.startsWith("audio/") && !accept.startsWith("video/");
}
