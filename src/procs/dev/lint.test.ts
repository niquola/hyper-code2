// UNIT test: src/dev/lint.test.ts ↔ src/dev/lint.ts (one function).
import { test, expect } from "bun:test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testCtx } from "../../$test";

const ctx = await testCtx();

test("lint: the project itself is clean", async () => {
    const r = await ctx.fns.procs.dev.lint({ silent: true });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
});

test("lint explains helper files in kebab route folders", async () => {
    const root = mkdtempSync(join(tmpdir(), "procs-lint-"));
    mkdirSync(`${root}/src/pill-tracker`, { recursive: true });
    await Bun.write(`${root}/src/pill-tracker/page.ts`, `export default function () { return "" }\n`);
    const run = await testCtx({ root });
    const r = await run.fns.procs.dev.lint({ silent: true });
    expect(r.ok).toBe(false);
    expect(r.errors.join("\n")).toContain("helper .ts file inside a kebab route folder");
    expect(r.errors.join("\n")).toContain("src/pills/shared.ts");
});
