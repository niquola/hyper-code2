import { Glob } from "bun";
import { resolve, relative, dirname, basename } from "node:path";

const METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);

export default async function (ctx: Context) {
    const srcDir = resolve(import.meta.dir, "..");
    const hyperDir = resolve(srcDir, "..", ".hyper");
    ctx.routes = ctx.routes || {};
    for (const root of [srcDir, hyperDir]) {
        const exists = await Bun.file(root).stat().then(() => true).catch(() => false);
        if (!exists) continue;
        const label = root === hyperDir ? ".hyper" : "src";
        const glob = new Glob("**/$route_*.ts");
        for await (const file of glob.scan(root)) {
            const abs = resolve(root, file);
            const rel = relative(root, abs);
            const moduleDir = dirname(rel);
            const fileName = basename(rel, ".ts");
            const parsed = parseRouteFile(fileName);
            if (!parsed) { console.warn(`[routes] skip (bad name): ${label}/${rel}`); continue; }
            const { pathParts, method } = parsed;
            const moduleSegments = moduleDir === "." ? [] : moduleDir.split("/");
            const allSegments = [...moduleSegments, ...pathParts]
                .filter(s => s.length > 0)
                .map(s => s.startsWith("$") ? `:${s.slice(1)}` : s);
            const routePath = "/" + allSegments.join("/");
            const mod = await import(abs + `?t=${Date.now()}`);
            const handler = mod.default;
            if (typeof handler !== "function") { console.warn(`[routes] skip (no default export): ${label}/${rel}`); continue; }
            ctx.routes[routePath] = ctx.routes[routePath] || {};
            ctx.routes[routePath][method] = handler;
            console.log(`[routes] ${method.padEnd(6)} ${routePath}  ←  ${label}/${rel}`);
        }

        // Static scripts: <module>/$script_<name>.<ext> → GET /<module>/<name>.<ext>
        const scriptGlob = new Glob("**/$script_*.{js,mjs,css}");
        for await (const file of scriptGlob.scan(root)) {
            const abs = resolve(root, file);
            const rel = relative(root, abs);
            const moduleDir = dirname(rel);
            const fileName = basename(rel);
            const m = /^\$script_(.+?)(\.\w+)$/.exec(fileName);
            if (!m || !m[1] || !m[2]) { console.warn(`[scripts] skip (bad name): ${label}/${rel}`); continue; }
            const name = m[1]; const ext = m[2];
            const segs = moduleDir === "." ? [] : moduleDir.split("/");
            const routePath = "/" + [...segs, name + ext].join("/");
            const handler = (() => async () => new Response(Bun.file(abs)))();
            ctx.routes[routePath] = ctx.routes[routePath] || {};
            ctx.routes[routePath].GET = handler;
            console.log(`[scripts] GET    ${routePath}  ←  ${label}/${rel}`);
        }
    }
    return ctx.routes;
}

function parseRouteFile(fileName: string): { pathParts: string[]; method: string } | null {
    if (!fileName.startsWith("$route_")) return null;
    const rest = fileName.slice("$route_".length);
    const idx = rest.lastIndexOf("_");
    let pathRaw: string;
    let method: string;
    if (idx === -1) {
        pathRaw = "";
        method = rest;
    } else {
        pathRaw = rest.slice(0, idx);
        method = rest.slice(idx + 1);
    }
    if (!METHODS.has(method)) return null;
    const pathParts = pathRaw === "" ? [] : pathRaw.split("_");
    return { pathParts, method };
}
