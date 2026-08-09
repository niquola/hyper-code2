import { stat } from "node:fs/promises";

// True if `path` exists (file or directory), relative to workspace root.
export default async function (ctx: Context, _session: Session | null, opts: { path: string }): Promise<boolean> {
    const abs = ctx.fns.files.resolveSafe({ path: opts.path });
    return stat(abs).then(() => true).catch(() => false);
}
