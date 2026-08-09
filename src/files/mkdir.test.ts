import { test, expect, describe, afterAll } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

const TEST_DIR = ".test-tmp/mkdir";

afterAll(async () => { await Bun.$`rm -rf ${TEST_DIR}`.quiet(); });

describe("files.mkdir", () => {
    test("creates nested dirs", async () => {
        const ctx = await mkTestCtx();
        await ctx.fns.files.mkdir({ path: `${TEST_DIR}/a/b/c` });
        expect(await ctx.fns.files.exists({ path: `${TEST_DIR}/a/b/c` })).toBe(true);
    });

    test("is idempotent (no throw on existing)", async () => {
        const ctx = await mkTestCtx();
        await ctx.fns.files.mkdir({ path: `${TEST_DIR}/same` });
        await ctx.fns.files.mkdir({ path: `${TEST_DIR}/same` });
        expect(await ctx.fns.files.exists({ path: `${TEST_DIR}/same` })).toBe(true);
    });
});
