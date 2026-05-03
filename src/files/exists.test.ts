import { test, expect, describe } from "bun:test";
import loadFns from "../loadFns";
import exists from "./exists";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    return ctx;
};

describe("files.exists", () => {
    test("true for existing file", async () => {
        const ctx = await mkCtx();
        expect(await exists(ctx, { path: "README.md" })).toBe(true);
    });

    test("false for missing file", async () => {
        const ctx = await mkCtx();
        expect(await exists(ctx, { path: ".hyper/nope-" + Math.random().toString(36).slice(2) })).toBe(false);
    });

    test("refuses outside workspace", async () => {
        const ctx = await mkCtx();
        await expect(exists(ctx, { path: "../secret" })).rejects.toThrow(/outside workspace/);
    });
});
