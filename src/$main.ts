import { Glob } from "bun";
import { resolve, dirname, basename } from "node:path";

export default async function () {
    const ctx = {
        env: { ...process.env },
        state: {},
        fns: {} as FnsRegistry,
        routes: {},
    } as Context;

    await loadFns(ctx);
    await ctx.genTypes(ctx);
    await ctx.fns.http.loadRoutes(ctx);
    await ctx.fns.server.start(ctx);
    return ctx;
}

async function loadFns(ctx: Context) {
    const srcDir = resolve(import.meta.dir);
    const glob = new Glob("**/*.ts");

    for await (const file of glob.scan(srcDir)) {
        if (!shouldLoadFn(file)) continue;

        const abs = resolve(srcDir, file);
        const mod = await import(abs + `?t=${Date.now()}`);
        const fn = mod.default;
        if (typeof fn !== "function") continue;

        const rawName = basename(file, ".ts");
        const fnName = rawName.startsWith("$") ? rawName.slice(1) : rawName;
        const modDir = dirname(file);

        if (modDir === ".") {
            (ctx as any)[fnName] = fn;
            console.log(`[fns] ctx.${fnName}  ←  ${file}`);
        } else {
            const segments = modDir.split("/");
            let target: any = ctx.fns;
            for (const seg of segments) {
                target[seg] = target[seg] || {};
                target = target[seg];
            }
            target[fnName] = fn;
            console.log(`[fns] ctx.fns.${segments.join(".")}.${fnName}  ←  ${file}`);
        }
    }
}

function shouldLoadFn(file: string): boolean {
    if (file.endsWith(".test.ts") || file.endsWith(".d.ts")) return false;
    const name = basename(file, ".ts");
    if (name === "$main" || name === "$test") return false;
    if (name.startsWith("$route_")) return false;
    if (name.startsWith("$type_")) return false;
    return true;
}

if (import.meta.main) {
    const main = (await import("./$main.ts")).default;
    const ctx = await main();
    (globalThis as any).ctx = ctx;
    console.log("\nctx keys:", Object.keys(ctx));
    console.log("ctx.fns:", JSON.stringify(mapShape(ctx.fns), null, 2));
}

function mapShape(obj: any): any {
    if (typeof obj === "function") return "[fn]";
    if (obj && typeof obj === "object") {
        const out: any = {};
        for (const k of Object.keys(obj)) out[k] = mapShape(obj[k]);
        return out;
    }
    return typeof obj;
}
