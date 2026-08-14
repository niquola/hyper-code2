import { mkdir } from "node:fs/promises";

// Create a directory (recursive). No-op if it already exists.
/** Creates a workspace directory. */
export default async function (ctx: Context, _session: Session | null, opts: { /** Workspace-relative path. */ path: string }): Promise<void> {
    const abs = ctx.fns.files.resolveSafe({ path: opts.path });
    await mkdir(abs, { recursive: true });
}
