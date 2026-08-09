import { test, expect, describe, afterAll } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

const TEST_DIR = ".test-tmp/write";

afterAll(async () => { await Bun.$`rm -rf ${TEST_DIR}`.quiet(); });

describe("files.write", () => {
    test("creates a file and its parent directories", async () => {
        const ctx = await mkTestCtx();
        const path = `${TEST_DIR}/deep/nested/hello.txt`;
        const res = await ctx.fns.files.write({ path, content: "hi!" });
        expect(res.bytes).toBe(3);
        expect(await ctx.fns.files.read({ path })).toBe("hi!");
    });

    test("overwrites existing file", async () => {
        const ctx = await mkTestCtx();
        const path = `${TEST_DIR}/overwrite.txt`;
        await ctx.fns.files.write({ path, content: "v1" });
        await ctx.fns.files.write({ path, content: "v2 longer" });
        expect(await ctx.fns.files.read({ path })).toBe("v2 longer");
    });

    test("can write outside the workspace (sandbox removed)", async () => {
        const ctx = await mkTestCtx();
        const abs = `/tmp/hyper_write_${Math.random().toString(36).slice(2)}.txt`;
        try {
            await ctx.fns.files.write({ path: abs, content: "x" });
            expect(await ctx.fns.files.read({ path: abs })).toBe("x");
        } finally {
            await Bun.$`rm -f ${abs}`.quiet();
        }
    });
});
