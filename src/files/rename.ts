import { rename } from "node:fs/promises";

// Rename / move a file or directory. Both paths resolved under workspace root.
export default async function (ctx: Context, from: string, to: string): Promise<void> {
    const absFrom = ctx.fns.files.resolveSafe(ctx, from);
    const absTo = ctx.fns.files.resolveSafe(ctx, to);
    await rename(absFrom, absTo);
    const open = ctx.fns.files.listOpen(ctx);
    if (open.includes(from)) {
        ctx.fns.files.close(ctx, from);
        ctx.fns.files.open(ctx, to);
    }
}
