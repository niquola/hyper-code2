import { test, expect, describe } from "bun:test";
import load from "./load";

const mkCtx = () => ({ fns: {} }) as unknown as Context;

describe("repl.load", () => {
    test("loads a single function by dotted path", async () => {
        const ctx = mkCtx();
        const result = await load(ctx, "db.connect");
        expect(result).toEqual({ reloaded: "db.connect" });
        expect((ctx.fns as any).db.connect).toBeTypeOf("function");
    });

    test("loads all functions in a folder", async () => {
        const ctx = mkCtx();
        const result = await load(ctx, "db");
        expect(result.reloaded).toBe("db");
        expect(result.count).toBeGreaterThanOrEqual(2);
        expect(result.fns).toContain("connect");
        expect(result.fns).toContain("migrate");
    });

    test("throws on missing specific file", async () => {
        const ctx = mkCtx();
        await expect(load(ctx, "db.doesNotExist")).rejects.toThrow(/no file for db\/doesNotExist/);
    });

    test("non-existent folder yields zero count (no throw)", async () => {
        const ctx = mkCtx();
        const result = await load(ctx, "nonexistent");
        expect(result).toEqual({ reloaded: "nonexistent", count: 0, fns: [] });
    });
});
