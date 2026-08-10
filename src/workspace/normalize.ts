import { resolve } from "node:path";
import { stat } from "node:fs/promises";

export default async function (
    _ctx: Context,
    _session: Session | null,
    opts: { dir?: string },
): Promise<string> {
    const dir = resolve(opts.dir?.trim() || process.cwd());
    const info = await stat(dir).catch(() => null);
    if (!info?.isDirectory()) throw new Error(`workspace directory not found: ${dir}`);
    return dir;
}