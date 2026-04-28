import { resolve } from "node:path";

export default async function (_ctx: Context) {
    const srcDir = resolve(import.meta.dir, "..");
    const hyperDir = resolve(srcDir, "..", ".hyper");
    const roots = [
        { name: "src", dir: srcDir },
        { name: ".hyper", dir: hyperDir },
    ];
    const out: Array<{ name: string; dir: string }> = [];
    for (const root of roots) {
        const exists = await Bun.file(root.dir).stat().then(() => true).catch(() => false);
        if (exists) out.push(root);
    }
    return out;
}
