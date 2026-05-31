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

    test("can read a file outside the workspace (sandbox removed)", async () => {
        const ctx = await mkCtx();
        // ../<cwd-basename>/package.json is this very repo's package.json via a
        // parent-traversal path — proves out-of-cwd reads resolve, not throw.
        const { basename } = await import("node:path");
        const self = basename(process.cwd());
        const pkg = await read(ctx, { path: `../${self}/package.json` });
        expect(pkg).toContain("\"name\": \"hyper-code2\"");
    });
});
