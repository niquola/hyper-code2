import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/** Writes text to a workspace file. */
export default async function (ctx: Context, _session: Session | null, opts: { /** Workspace-relative path. */ path: string; /** Content to write. */ content: string }): Promise<{ bytes: number }> {
    const abs = ctx.fns.files.resolveSafe({ path: opts.path });
    await mkdir(dirname(abs), { recursive: true });
    const bytes = await Bun.write(abs, opts.content);
    return { bytes };
}
