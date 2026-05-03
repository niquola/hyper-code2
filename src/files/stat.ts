import { stat } from "node:fs/promises";

// File/dir metadata, or null if missing. All paths relative to workspace root.
export default async function (ctx: Context, opts: { path: string }): Promise<{
    isDir: boolean; size: number; mtime: number;
} | null> {
    const abs = ctx.fns.files.resolveSafe(ctx, { path: opts.path });
    const s = await stat(abs).catch(() => null);
    if (!s) return null;
    return { isDir: s.isDirectory(), size: s.size, mtime: s.mtimeMs };
}
