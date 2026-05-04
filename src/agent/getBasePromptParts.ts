import { resolve } from "node:path";

const CORE_PATH = resolve(import.meta.dir, "SYSTEM_PROMPT_CORE.txt");
const WIRE_PATH = resolve(import.meta.dir, "SYSTEM_PROMPT.txt");

export default async function (_ctx: Context) {
    const core = await Bun.file(CORE_PATH).text();
    const wire = await Bun.file(WIRE_PATH).text();
    return { core, wire };
}