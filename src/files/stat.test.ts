import { test, expect, describe } from "bun:test";
import loadFns from "../loadFns";
import stat from "./stat";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    return ctx;
};

describe("files.stat", () => {
    test("returns metadata for an existing file", async () => {
        const ctx = await mkCtx();
        const s = await stat(ctx, { path: "README.md" });
        expect(s).not.toBeNull();
        expect(s!.isDir).toBe(false);
        expect(s!.size).toBeGreaterThan(0);
        expect(typeof s!.mtime).toBe("number");
    });

    test("returns metadata for a directory (isDir=true)", async () => {
        const ctx = await mkCtx();
        const s = await stat(ctx, { path: "src" });
        expect(s).not.toBeNull();
        expect(s!.isDir).toBe(true);
    });

    test("returns null for missing path", async () => {
        const ctx = await mkCtx();
        expect(await stat(ctx, { path: ".hyper/nope-" + Math.random().toString(36).slice(2) })).toBeNull();
    });
});
