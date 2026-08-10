// google.accounts — authorized Google accounts (one unified token per account
// in .secrets/google/). Shared by every google-* module's accounts.ts.
import { resolve } from "node:path";
import { readdir } from "node:fs/promises";

export default async function (_ctx: Context, _session: Session | null, _opts?: {}) {
    const dir = resolve(import.meta.dir, "../../.secrets/google");
    try {
        const files = await readdir(dir);
        return files
            .filter((f) => f.startsWith("token-") && f.endsWith(".json"))
            .map((f) => f.replace(/^token-/, "").replace(/\.json$/, ""));
    } catch {
        return [];
    }
}
