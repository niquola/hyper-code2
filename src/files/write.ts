import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export default async function (ctx: Context, _session: Session | null, opts: { path: string; content: string }): Promise<{ bytes: number }> {
    const abs = ctx.fns.files.resolveSafe({ path: opts.path });
    await mkdir(dirname(abs), { recursive: true });
    const bytes = await Bun.write(abs, opts.content);
    return { bytes };
}
