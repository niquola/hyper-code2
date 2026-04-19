import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export default async function (ctx: Context, path: string, content: string): Promise<{ bytes: number }> {
    const abs = ctx.fns.files.resolveSafe(ctx, path);
    await mkdir(dirname(abs), { recursive: true });
    const bytes = await Bun.write(abs, content);
    return { bytes };
}
