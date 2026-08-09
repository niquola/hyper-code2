import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("files.exists", () => {
    test("true for existing file", async () => {
        const ctx = await mkTestCtx();
        expect(await ctx.fns.files.exists({ path: "README.md" })).toBe(true);
    });

    test("false for missing file", async () => {
        const ctx = await mkTestCtx();
        expect(await ctx.fns.files.exists({ path: ".hyper/nope-" + Math.random().toString(36).slice(2) })).toBe(false);
    });

    test("checks paths outside the workspace (sandbox removed)", async () => {
        const ctx = await mkTestCtx();
        // resolves & stats out-of-cwd instead of throwing; this one doesn't exist
        expect(await ctx.fns.files.exists({ path: "../nope-" + Math.random().toString(36).slice(2) })).toBe(false);
    });
});
