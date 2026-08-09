import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("files.stat", () => {
    test("returns metadata for an existing file", async () => {
        const ctx = await mkTestCtx();
        const s = await ctx.fns.files.stat({ path: "README.md" });
        expect(s).not.toBeNull();
        expect(s!.isDir).toBe(false);
        expect(s!.size).toBeGreaterThan(0);
        expect(typeof s!.mtime).toBe("number");
    });

    test("returns metadata for a directory (isDir=true)", async () => {
        const ctx = await mkTestCtx();
        const s = await ctx.fns.files.stat({ path: "src" });
        expect(s).not.toBeNull();
        expect(s!.isDir).toBe(true);
    });

    test("returns null for missing path", async () => {
        const ctx = await mkTestCtx();
        expect(await ctx.fns.files.stat({ path: ".hyper/nope-" + Math.random().toString(36).slice(2) })).toBeNull();
    });
});
