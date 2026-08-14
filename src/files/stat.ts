import { stat } from "node:fs/promises";

// File/dir metadata, or null if missing. All paths relative to workspace root.
/** Returns metadata for a workspace path. */
export default async function (ctx: Context, _session: Session | null, opts: { /** Workspace-relative path. */ path: string }): Promise<{
    isDir: boolean; size: number; mtime: number;
} | null> {
    const abs = ctx.fns.files.resolveSafe({ path: opts.path });
    const s = await stat(abs).catch(() => null);
    if (!s) return null;
    return { isDir: s.isDirectory(), size: s.size, mtime: s.mtimeMs };
}
