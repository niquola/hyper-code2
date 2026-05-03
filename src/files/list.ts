import { readdir } from "node:fs/promises";

const SKIP_NAMES = new Set(["node_modules", ".git", ".DS_Store"]);

// List a directory's immediate children, relative to workspace root.
// Dirs first, alphabetical. Skips node_modules / .git / .DS_Store.
export default async function (ctx: Context, opts: { path?: string } = {}): Promise<Array<{
    name: string;
    isDir: boolean;
}>> {
    const abs = ctx.fns.files.resolveSafe(ctx, { path: opts.path ?? "" });
    const entries = await readdir(abs, { withFileTypes: true });
    return entries
        .filter(e => !SKIP_NAMES.has(e.name))
        .map(e => ({ name: e.name, isDir: e.isDirectory() }))
        .sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
}
