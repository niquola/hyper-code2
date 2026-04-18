import { resolve } from "node:path";

export default async function (_ctx: Context): Promise<string> {
    return await Bun.file(resolve(import.meta.dir, "SYSTEM_PROMPT.md")).text();
}
