import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("files.grepHashline", () => {
    test("returns anchored grep rows", async () => {
        const ctx = await mkTestCtx();
        const path = ".test-tmp/hashline_grep/a.txt";
        await ctx.fns.files.write({ path, content: "hello\nworld\nhello again\n" });
        const rows = await ctx.fns.files.grepHashline({ pattern: "hello", path: ".test-tmp/hashline_grep" });
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0]!.anchor).toMatch(/^\d+[a-z0-9]{2}$/);
    });
});