import { test, expect, describe, afterAll } from "bun:test";
import loadFns from "../loadFns";
import write from "./write";
import rename from "./rename";
import read from "./read";
import exists from "./exists";
import open from "./open";
import listOpen from "./listOpen";

const TEST_DIR = ".hyper/_test_rename";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    return ctx;
};

afterAll(async () => { await Bun.$`rm -rf ${TEST_DIR}`.quiet(); });

describe("files.rename", () => {
    test("moves a file preserving content", async () => {
        const ctx = await mkCtx();
        const from = `${TEST_DIR}/a.txt`;
        const to = `${TEST_DIR}/b.txt`;
        await write(ctx, { path: from, content: "hello" });
        await rename(ctx, { from, to });
        expect(await exists(ctx, { path: from })).toBe(false);
        expect(await read(ctx, { path: to })).toBe("hello");
    });

    test("migrates open-tab entry", async () => {
        const ctx = await mkCtx();
        const from = `${TEST_DIR}/c.txt`;
        const to = `${TEST_DIR}/d.txt`;
        await write(ctx, { path: from, content: "yo" });
        open(ctx, { path: from });
        await rename(ctx, { from, to });
        const tabs = listOpen(ctx);
        expect(tabs).not.toContain(from);
        expect(tabs).toContain(to);
    });
});
