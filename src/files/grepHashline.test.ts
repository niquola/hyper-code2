import { test, expect, describe } from "bun:test";
import loadFns from "../loadFns";
import write from "./write";
import grepHashline from "./grepHashline";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    return ctx;
};

describe("files.grepHashline", () => {
    test("returns anchored grep rows", async () => {
        const ctx = await mkCtx();
        const path = ".hyper/_test_hashline_grep/a.txt";
        await write(ctx, { path, content: "hello\nworld\nhello again\n" });
        const rows = await grepHashline(ctx, { pattern: "hello", path: ".hyper/_test_hashline_grep" });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0]!.anchor).toMatch(/^\d+[a-z0-9]{2}$/);
    });
});