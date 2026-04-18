import { test, expect, describe } from "bun:test";
import load from "./load";

const mkCtx = () => ({ fns: {} }) as unknown as Context;

describe("repl.load", () => {
    test("loads a single function by dotted path", async () => {
        const ctx = mkCtx();
        const result = await load(ctx, "db.query");
        expect(result).toEqual({ reloaded: "db.query" });
        expect((ctx.fns as any).db.query).toBeTypeOf("function");
    });

    test("finds $-prefixed files too ($start.ts)", async () => {
        const ctx = mkCtx();
        const result = await load(ctx, "db.start");
        expect(result).toEqual({ reloaded: "db.start" });
        expect((ctx.fns as any).db.start).toBeTypeOf("function");
    });

    test("loads all functions in a folder", async () => {
        const ctx = mkCtx();
        const result = await load(ctx, "db");
        expect(result.reloaded).toBe("db");
        expect(result.count).toBeGreaterThanOrEqual(3);
        expect(result.fns).toContain("query");
        expect(result.fns).toContain("execute");
        expect(result.fns).toContain("start");
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
