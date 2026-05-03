import { test, expect, describe, afterAll } from "bun:test";
import loadFns from "../loadFns";
import write from "./write";
import remove from "./remove";
import exists from "./exists";
import open from "./open";
import listOpen from "./listOpen";

const TEST_DIR = ".hyper/_test_remove";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    return ctx;
};

afterAll(async () => { await Bun.$`rm -rf ${TEST_DIR}`.quiet(); });

describe("files.remove", () => {
    test("deletes a file", async () => {
        const ctx = await mkCtx();
        const path = `${TEST_DIR}/tmp.txt`;
        await write(ctx, { path, content: "x" });
        await remove(ctx, { path });
        expect(await exists(ctx, { path })).toBe(false);
    });

    test("no-op on missing path", async () => {
        const ctx = await mkCtx();
        await remove(ctx, { path: `${TEST_DIR}/ghost-${Math.random()}` });
    });

    test("also removes from open tabs", async () => {
        const ctx = await mkCtx();
        const path = `${TEST_DIR}/closing.txt`;
        await write(ctx, { path, content: "x" });
        open(ctx, { path });
        expect(listOpen(ctx)).toContain(path);
        await remove(ctx, { path });
        expect(listOpen(ctx)).not.toContain(path);
    });
});
