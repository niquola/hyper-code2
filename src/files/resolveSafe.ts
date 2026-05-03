import { resolve } from "node:path";

// Resolve `path` against the workspace root (cwd) and ensure the result stays within it.
// Throws on any attempt to escape. Empty path == workspace root.
export default function (_ctx: Context, opts: { path: string }): string {
    const path = opts.path;
    const root = resolve(process.cwd());
    const abs = resolve(root, path || ".");
    if (abs !== root && !abs.startsWith(root + "/")) {
        throw new Error(`outside workspace: ${path}`);
    }
    return abs;
}
