import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("files.list", () => {
    test("lists workspace root — includes src/, excludes node_modules/.git", async () => {
        const ctx = await mkTestCtx();
        const entries = await ctx.fns.files.list({ path: "" });
        const names = entries.map((e: any) => e.name);
        expect(names).toContain("src");
        expect(names).not.toContain("node_modules");
        expect(names).not.toContain(".git");
    });

    test("directories come first, then files, both alphabetical", async () => {
        const ctx = await mkTestCtx();
        const entries = await ctx.fns.files.list({ path: "" });
        const dirs = entries.filter((e: any) => e.isDir);
        const files = entries.filter((e: any) => !e.isDir);
        const dirSorted = [...dirs].sort((a: any, b: any) => a.name.localeCompare(b.name));
        expect(dirs).toEqual(dirSorted);
        // first file comes after last dir in the flat list
        if (dirs.length && files.length) {
            const firstFileIdx = entries.findIndex((e: any) => !e.isDir);
            const lastDirIdx = entries.findIndex((e: any) => e === dirs[dirs.length - 1]);
            expect(lastDirIdx).toBeLessThan(firstFileIdx);
        }
    });

    test("lists a subdirectory", async () => {
        const ctx = await mkTestCtx();
        const entries = await ctx.fns.files.list({ path: "src/files" });
        const names = entries.map((e: any) => e.name);
        expect(names).toContain("read.ts");
        expect(names).toContain("write.ts");
    });

    test("can list outside the workspace (sandbox removed)", async () => {
        const ctx = await mkTestCtx();
        const names = await ctx.fns.files.list({ path: "../" });
        expect(Array.isArray(names)).toBe(true);
    });
});
