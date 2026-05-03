import { rm } from "node:fs/promises";

// Delete a file or directory. Recursive for directories.
// Also removes the path from the open-tabs list if present.
export default async function (ctx: Context, opts: { path: string }): Promise<void> {
    const abs = ctx.fns.files.resolveSafe(ctx, { path: opts.path });
    await rm(abs, { recursive: true, force: true });
    ctx.fns.files.close(ctx, { path: opts.path });
}
