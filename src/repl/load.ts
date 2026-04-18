import { Glob } from "bun";
import { resolve, basename } from "node:path";

export default async function (ctx: Context, target: string) {
    if (target.includes(".")) {
        const segs = target.split(".");
        const fnName = segs.pop()!;
        const modPath = segs.join("/");
        await loadFile(ctx, modPath, fnName);
        return { reloaded: target };
    }

    const srcDir = resolve(import.meta.dir, "..");
    const glob = new Glob(`${target}/*.ts`);
    const loaded: string[] = [];
    for await (const file of glob.scan(srcDir)) {
        const raw = basename(file, ".ts");
        if (!isFnFile(raw, file)) continue;
        const fnName = raw.startsWith("$") ? raw.slice(1) : raw;
        await loadFile(ctx, target, fnName);
        loaded.push(fnName);
    }
    return { reloaded: target, count: loaded.length, fns: loaded };
}

async function loadFile(ctx: Context, modPath: string, fnName: string) {
    const srcDir = resolve(import.meta.dir, "..");
    const candidates = [`${modPath}/${fnName}.ts`, `${modPath}/$${fnName}.ts`];
    for (const rel of candidates) {
        const abs = resolve(srcDir, rel);
        if (!(await Bun.file(abs).exists())) continue;
        const m = await import(abs + `?t=${Date.now()}`);
        const fn = m.default;
        if (typeof fn !== "function") throw new Error(`${rel}: no default function export`);
        const segs = modPath.split("/");
        let tgt: any = ctx.fns;
        for (const seg of segs) {
            tgt[seg] = tgt[seg] || {};
            tgt = tgt[seg];
        }
        tgt[fnName] = fn;
        console.log(`[reload] ctx.fns.${segs.join(".")}.${fnName}  ←  ${rel}`);
        return;
    }
    throw new Error(`no file for ${modPath}/${fnName}`);
}

function isFnFile(name: string, file: string): boolean {
    if (file.endsWith(".test.ts") || file.endsWith(".d.ts")) return false;
    if (name === "$main" || name === "$test") return false;
    if (name.startsWith("$route_")) return false;
    if (name.startsWith("$type_")) return false;
    return true;
}
