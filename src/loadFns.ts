import { Glob } from "bun";
import { resolve, dirname, basename } from "node:path";

// Scan src/ and .hyper/ for function files (everything that's NOT a $route_*, $type_*, $test, $main or *.test.ts)
// and register them on ctx:
//   src/<module>/<fn>.ts  → ctx.fns.<module>.<fn>
//   src/<fn>.ts           → ctx.<fn>            (root fn)
// The `$` prefix is stripped from the runtime name.
export default async function (ctx: Context): Promise<void> {
    const srcDir = resolve(import.meta.dir);
    const hyperDir = resolve(srcDir, "..", ".hyper");
    for (const root of [srcDir, hyperDir]) {
        const exists = await Bun.file(root).stat().then(() => true).catch(() => false);
        if (!exists) continue;
        const label = root === hyperDir ? ".hyper" : "src";
        const glob = new Glob("**/*.ts");
        for await (const file of glob.scan(root)) {
            if (!shouldLoadFn(file)) continue;
            const abs = resolve(root, file);
            const mod = await import(abs + `?t=${Date.now()}`);
            const fn = mod.default;
            if (typeof fn !== "function") continue;
            const rawName = basename(file, ".ts");
            const fnName = rawName.startsWith("$") ? rawName.slice(1) : rawName;
            const modDir = dirname(file);
            if (modDir === ".") {
                (ctx as any)[fnName] = fn;
                console.log(`[fns] ctx.${fnName}  ←  ${label}/${file}`);
            } else {
                const segments = modDir.split("/");
                let target: any = ctx.fns;
                for (const seg of segments) {
                    target[seg] = target[seg] || {};
                    target = target[seg];
                }
                target[fnName] = fn;
                console.log(`[fns] ctx.fns.${segments.join(".")}.${fnName}  ←  ${label}/${file}`);
            }
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
