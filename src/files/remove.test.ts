import { test, expect, describe, afterAll } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

const TEST_DIR = ".test-tmp/remove";

afterAll(async () => { await Bun.$`rm -rf ${TEST_DIR}`.quiet(); });

describe("files.remove", () => {
    test("deletes a file", async () => {
        const ctx = await mkTestCtx();
        const path = `${TEST_DIR}/tmp.txt`;
        await ctx.fns.files.write({ path, content: "x" });
        await ctx.fns.files.remove({ path });
        expect(await ctx.fns.files.exists({ path })).toBe(false);
    });

    test("no-op on missing path", async () => {
        const ctx = await mkTestCtx();
        await ctx.fns.files.remove({ path: `${TEST_DIR}/ghost-${Math.random()}` });
    });

    test("also removes from open tabs", async () => {
        const ctx = await mkTestCtx();
        const path = `${TEST_DIR}/closing.txt`;
        await ctx.fns.files.write({ path, content: "x" });
        ctx.fns.files.open({ path });
        expect(ctx.fns.files.listOpen({})).toContain(path);
        await ctx.fns.files.remove({ path });
        expect(ctx.fns.files.listOpen({})).not.toContain(path);
    });
});
