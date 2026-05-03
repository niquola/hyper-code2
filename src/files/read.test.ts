import { test, expect, describe } from "bun:test";
import loadFns from "../loadFns";
import read from "./read";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    return ctx;
};

describe("files.read", () => {
    test("reads an existing project file", async () => {
        const ctx = await mkCtx();
        const pkg = await read(ctx, { path: "package.json" });
        expect(pkg).toContain("\"name\": \"hyper-code2\"");
    });

    test("rejects paths that escape workspace", async () => {
        const ctx = await mkCtx();
        await expect(read(ctx, { path: "../secret" })).rejects.toThrow(/outside workspace/);
    });
});
