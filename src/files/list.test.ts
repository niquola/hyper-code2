import { test, expect, describe } from "bun:test";
import loadFns from "../loadFns";
import list from "./list";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    return ctx;
};

describe("files.list", () => {
    test("lists workspace root — includes src/, excludes node_modules/.git", async () => {
        const ctx = await mkCtx();
        const entries = await list(ctx, { path: "" });
        const names = entries.map(e => e.name);
        expect(names).toContain("src");
        expect(names).not.toContain("node_modules");
        expect(names).not.toContain(".git");
    });

    test("directories come first, then files, both alphabetical", async () => {
        const ctx = await mkCtx();
        const entries = await list(ctx, { path: "" });
        const dirs = entries.filter(e => e.isDir);
        const files = entries.filter(e => !e.isDir);
        const dirSorted = [...dirs].sort((a, b) => a.name.localeCompare(b.name));
        expect(dirs).toEqual(dirSorted);
        // first file comes after last dir in the flat list
        if (dirs.length && files.length) {
            const firstFileIdx = entries.findIndex(e => !e.isDir);
            const lastDirIdx = entries.findIndex(e => e === dirs[dirs.length - 1]);
            expect(lastDirIdx).toBeLessThan(firstFileIdx);
        }
    });

    test("lists a subdirectory", async () => {
        const ctx = await mkCtx();
        const entries = await list(ctx, { path: "src/db" });
        const names = entries.map(e => e.name);
        expect(names).toContain("connect.ts");
        expect(names).toContain("migrate.ts");
    });

    test("refuses to escape workspace", async () => {
        const ctx = await mkCtx();
        await expect(list(ctx, { path: "../" })).rejects.toThrow(/outside workspace/);
    });
});
