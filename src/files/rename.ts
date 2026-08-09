import { rename } from "node:fs/promises";

// Rename / move a file or directory. Both paths resolved under workspace root.
export default async function (ctx: Context, _session: Session | null, opts: { from: string; to: string }): Promise<void> {
    const absFrom = ctx.fns.files.resolveSafe({ path: opts.from });
    const absTo = ctx.fns.files.resolveSafe({ path: opts.to });
    await rename(absFrom, absTo);
    const open = ctx.fns.files.listOpen({});
    if (open.includes(opts.from)) {
        ctx.fns.files.close({ path: opts.from });
        ctx.fns.files.open({ path: opts.to });
    }
}
