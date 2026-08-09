// FUNCTIONAL test: src/project.test.ts ↔ the src/project/ namespace.
// Exercises scan + classify + roots working together over the real tree.
import { test, expect } from "bun:test";
import { testCtx } from "../$test";

const ctx = await testCtx();

test("project namespace: scan classifies the whole tree", async () => {
    const entries = await ctx.fns.procs.project.scan({});
    const fnRels = entries.filter((e: any) => e.kind === "fn").map((e: any) => e.rel);
    expect(fnRels).toContain("procs/project/scan.ts");   // the framework lives under its own name
    expect(entries.some((e: any) => e.kind === "route")).toBe(true);
    expect(entries.some((e: any) => e.kind === "type")).toBe(true);
    // .test.ts files are never registered
    expect(entries.some((e: any) => e.rel.endsWith(".test.ts") && e.kind !== "skip")).toBe(false);
});
