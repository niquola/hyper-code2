import { Glob } from "bun";
import { resolve } from "node:path";
import classify from "./classify";

export default async function (ctx: Context) {
    // ctx.fns.project.roots may not be loaded yet on the first bootstrap pass
    // (loadFns calls scan to populate ctx.fns) — fall back to a direct import.
    const rootsFn = ctx.fns.project?.roots ?? (await import("./roots?t=" + Date.now())).default;
    const roots = await rootsFn(ctx);
    const entries: any[] = [];
    for (const root of roots) {
        const glob = new Glob('**/*');
        for await (const rel of glob.scan(root.dir)) {
            const meta = classify(rel);
            entries.push({ ...meta, root: root.name, rootDir: root.dir, abs: resolve(root.dir, rel) });
        }
    }
    return entries;
}
