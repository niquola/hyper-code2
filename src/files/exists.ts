import { stat } from "node:fs/promises";

// True if `path` exists (file or directory), relative to workspace root.
export default async function (ctx: Context, opts: { path: string }): Promise<boolean> {
    const abs = ctx.fns.files.resolveSafe(ctx, { path: opts.path });
    return stat(abs).then(() => true).catch(() => false);
}
