import { test, expect, describe, afterAll } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

const TEST_DIR = ".test-tmp/rename";

afterAll(async () => { await Bun.$`rm -rf ${TEST_DIR}`.quiet(); });

describe("files.rename", () => {
    test("moves a file preserving content", async () => {
        const ctx = await mkTestCtx();
        const from = `${TEST_DIR}/a.txt`;
        const to = `${TEST_DIR}/b.txt`;
        await ctx.fns.files.write({ path: from, content: "hello" });
        await ctx.fns.files.rename({ from, to });
        expect(await ctx.fns.files.exists({ path: from })).toBe(false);
        expect(await ctx.fns.files.read({ path: to })).toBe("hello");
    });

    test("migrates open-tab entry", async () => {
        const ctx = await mkTestCtx();
        const from = `${TEST_DIR}/c.txt`;
        const to = `${TEST_DIR}/d.txt`;
        await ctx.fns.files.write({ path: from, content: "yo" });
        ctx.fns.files.open({ path: from });
        await ctx.fns.files.rename({ from, to });
        const tabs = ctx.fns.files.listOpen({});
        expect(tabs).not.toContain(from);
        expect(tabs).toContain(to);
    });
});
