import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export default async function (ctx: Context, opts: { path: string; content: string }): Promise<{ bytes: number }> {
    const abs = ctx.fns.files.resolveSafe(ctx, { path: opts.path });
    await mkdir(dirname(abs), { recursive: true });
    const bytes = await Bun.write(abs, opts.content);
    return { bytes };
}
