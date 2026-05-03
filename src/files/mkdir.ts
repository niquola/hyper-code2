import { mkdir } from "node:fs/promises";

// Create a directory (recursive). No-op if it already exists.
export default async function (ctx: Context, opts: { path: string }): Promise<void> {
    const abs = ctx.fns.files.resolveSafe(ctx, { path: opts.path });
    await mkdir(abs, { recursive: true });
}
