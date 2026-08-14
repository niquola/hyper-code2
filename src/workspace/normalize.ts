import { resolve } from "node:path";
import { mkdir, stat } from "node:fs/promises";

export default async function (
    _ctx: Context,
    _session: Session | null,
    opts: { dir?: string; create?: boolean },
): Promise<string> {
    const dir = resolve(opts.dir?.trim() || process.cwd());
    let info = await stat(dir).catch(() => null);
    if (!info && opts.create) {
        await mkdir(dir, { recursive: true });
        info = await stat(dir);
    }
    if (!info?.isDirectory()) throw new Error(`workspace directory not found: ${dir}`);
    return dir;
}