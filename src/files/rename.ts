import { rename } from "node:fs/promises";

// Rename / move a file or directory. Both paths resolved under workspace root.
export default async function (ctx: Context, opts: { from: string; to: string }): Promise<void> {
    const absFrom = ctx.fns.files.resolveSafe(ctx, { path: opts.from });
    const absTo = ctx.fns.files.resolveSafe(ctx, { path: opts.to });
    await rename(absFrom, absTo);
    const open = ctx.fns.files.listOpen(ctx);
    if (open.includes(opts.from)) {
        ctx.fns.files.close(ctx, { path: opts.from });
        ctx.fns.files.open(ctx, { path: opts.to });
    }
}
