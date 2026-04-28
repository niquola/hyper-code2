import { Glob } from "bun";
import { resolve } from "node:path";
import classify from "./classify";

export default async function (ctx: Context) {
    const roots = await ctx.fns.project.roots(ctx);
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
