import { resolve } from "node:path";

const CORE_PATH = resolve(import.meta.dir, "SYSTEM_PROMPT_CORE.txt");
const WIRE_PATH = resolve(import.meta.dir, "SYSTEM_PROMPT.txt");

/** Get base prompt parts for the runtime. */
export default async function (_ctx: Context, _session: Session | null, _opts?: {}) {
    const core = await Bun.file(CORE_PATH).text();
    // The wire prompt described the markers protocol; native tool calls made
    // it obsolete and the file is gone. Empty is the honest value — callers
    // show the section only when there is something to show.
    const wire = await Bun.file(WIRE_PATH).text().catch(() => "");
    return { core, wire };
}