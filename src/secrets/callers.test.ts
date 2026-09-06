import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// `secrets.resolve` is the bottom layer: it always spawns `op` (or reads env)
// and knows nothing about caching. `secrets.get` is the door — memory, then the
// encrypted `local_secrets` table, and 1Password only on a miss.
//
// Calling the bottom layer directly is not a style preference: it means every
// call hits 1Password, so the code fails whenever the vault is locked, and it
// fails at the worst moment — a service starting after a reboot, with nobody
// there to approve a prompt. The tunnel did exactly this and went dark; so did
// the UpToDate login.
//
// This test is the guard for code in this repository. Out-of-tree plugins are
// covered at runtime by the warning in `secrets/resolve.ts`.
const ALLOWED = new Set(["src/secrets", "src/procs"]);

function* sources(dir: string, root: string): Generator<string> {
    for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry.startsWith(".")) continue;
        const abs = join(dir, entry);
        if (statSync(abs).isDirectory()) { yield* sources(abs, root); continue; }
        if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) yield abs;
    }
}

describe("secrets", () => {
    test("nothing calls secrets.resolve behind the cache's back", () => {
        const root = join(import.meta.dir, "..", "..");
        const offenders: string[] = [];
        for (const dir of ["src", "plugins"]) {
            let abs: string;
            try { abs = join(root, dir); statSync(abs); } catch { continue; }
            for (const file of sources(abs, root)) {
                const rel = file.slice(root.length + 1);
                if ([...ALLOWED].some(prefix => rel.startsWith(prefix))) continue;
                if (/\bsecrets\.resolve\s*\(/.test(readFileSync(file, "utf8"))) offenders.push(rel);
            }
        }
        expect(offenders, `use ctx.fns.secrets.get({ ref }) — it caches; secrets.resolve always hits 1Password`).toEqual([]);
    });
});
