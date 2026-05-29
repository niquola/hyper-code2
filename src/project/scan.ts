import { Glob } from "bun";
import { resolve } from "node:path";
import classify from "./classify";

// Directory segments that are runtime/test/scratch — never part of the app.
// Mirrors .gitignore (.hyper/_runtime, _test_*, _tmp_*, tmp_*). Skipping them
// here is the load-bearing guarantee that a stray .ts fixture under e.g.
// .hyper/_test_*/ can NEVER be registered as a ctx.fns.* or pulled into the
// core ctx_ns.d.ts. Core code lives under src/; nothing core-related may leak
// in from these dirs.
const IGNORED_SEGMENT = /^(_runtime|_test_.*|_tmp_.*|tmp_.*)$/;
function isIgnoredPath(rel: string): boolean {
    return rel.split('/').some(seg => IGNORED_SEGMENT.test(seg));
}

export default async function (ctx: Context) {
    // ctx.fns.project.roots may not be loaded yet on the first bootstrap pass
    // (loadFns calls scan to populate ctx.fns) — fall back to a direct import.
    const rootsFn = ctx.fns.project?.roots ?? (await import("./roots?t=" + Date.now())).default;
    const roots = await rootsFn(ctx);
    const entries: any[] = [];
    for (const root of roots) {
        const glob = new Glob('**/*');
        for await (const rel of glob.scan(root.dir)) {
            if (isIgnoredPath(rel)) continue;
            const meta = classify(rel);
            entries.push({ ...meta, root: root.name, rootDir: root.dir, abs: resolve(root.dir, rel) });
        }
    }
    return entries;
}
