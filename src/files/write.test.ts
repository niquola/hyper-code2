import { test, expect, describe, afterAll } from "bun:test";
import loadFns from "../loadFns";
import write from "./write";
import read from "./read";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    return ctx;
};

const TEST_DIR = ".hyper/_test_write";

afterAll(async () => { await Bun.$`rm -rf ${TEST_DIR}`.quiet(); });

describe("files.write", () => {
    test("creates a file and its parent directories", async () => {
        const ctx = await mkCtx();
        const path = `${TEST_DIR}/deep/nested/hello.txt`;
        const res = await write(ctx, { path, content: "hi!" });
        expect(res.bytes).toBe(3);
        expect(await read(ctx, { path })).toBe("hi!");
    });

    test("overwrites existing file", async () => {
        const ctx = await mkCtx();
        const path = `${TEST_DIR}/overwrite.txt`;
        await write(ctx, { path, content: "v1" });
        await write(ctx, { path, content: "v2 longer" });
        expect(await read(ctx, { path })).toBe("v2 longer");
    });

    test("refuses paths outside workspace", async () => {
        const ctx = await mkCtx();
        await expect(write(ctx, { path: "../evil.txt", content: "x" })).rejects.toThrow(/outside workspace/);
    });
});
