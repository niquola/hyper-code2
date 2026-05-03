import { test, expect, describe, afterAll } from "bun:test";
import loadFns from "../loadFns";
import mkdir from "./mkdir";
import exists from "./exists";

const TEST_DIR = ".hyper/_test_mkdir";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    return ctx;
};

afterAll(async () => { await Bun.$`rm -rf ${TEST_DIR}`.quiet(); });

describe("files.mkdir", () => {
    test("creates nested dirs", async () => {
        const ctx = await mkCtx();
        await mkdir(ctx, { path: `${TEST_DIR}/a/b/c` });
        expect(await exists(ctx, { path: `${TEST_DIR}/a/b/c` })).toBe(true);
    });

    test("is idempotent (no throw on existing)", async () => {
        const ctx = await mkCtx();
        await mkdir(ctx, { path: `${TEST_DIR}/same` });
        await mkdir(ctx, { path: `${TEST_DIR}/same` });
        expect(await exists(ctx, { path: `${TEST_DIR}/same` })).toBe(true);
    });
});
