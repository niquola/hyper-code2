import { stat } from "node:fs/promises";

// True if `path` exists (file or directory), relative to workspace root.
export default async function (ctx: Context, path: string): Promise<boolean> {
    const abs = ctx.fns.files.resolveSafe(ctx, path);
    return stat(abs).then(() => true).catch(() => false);
}
