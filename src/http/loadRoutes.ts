import { Glob } from "bun";
import { resolve, relative, dirname, basename } from "node:path";

const METHODS = new Set(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]);

export default async function (ctx: Context) {
    const srcDir = resolve(import.meta.dir, "..");
    const glob = new Glob("**/$route_*.ts");

    ctx.routes = ctx.routes || {};

    for await (const file of glob.scan(srcDir)) {
        const abs = resolve(srcDir, file);
        const rel = relative(srcDir, abs);
        const moduleDir = dirname(rel);
        const fileName = basename(rel, ".ts");

        const parsed = parseRouteFile(fileName);
        if (!parsed) {
            console.warn(`[routes] skip (bad name): ${rel}`);
            continue;
        }
        const { pathParts, method } = parsed;

        const moduleSegments = moduleDir === "." ? [] : moduleDir.split("/");
        const allSegments = [...moduleSegments, ...pathParts]
            .filter(s => s.length > 0)
            .map(s => s.startsWith("$") ? `:${s.slice(1)}` : s);
        const routePath = "/" + allSegments.join("/");

        const mod = await import(abs + `?t=${Date.now()}`);
        const handler = mod.default;
        if (typeof handler !== "function") {
            console.warn(`[routes] skip (no default export): ${rel}`);
            continue;
        }

        ctx.routes[routePath] = ctx.routes[routePath] || {};
        ctx.routes[routePath][method] = handler;
        console.log(`[routes] ${method.padEnd(6)} ${routePath}  ←  ${rel}`);
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
