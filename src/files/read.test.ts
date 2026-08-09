import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("files.read", () => {
    test("reads an existing project file", async () => {
        const ctx = await mkTestCtx();
        const pkg = await ctx.fns.files.read({ path: "package.json" });
        expect(pkg).toContain("\"name\": \"hyper-code2\"");
    });

    test("can read a file outside the workspace (sandbox removed)", async () => {
        const ctx = await mkTestCtx();
        // ../<cwd-basename>/package.json is this very repo's package.json via a
        // parent-traversal path — proves out-of-cwd reads resolve, not throw.
        const { basename } = await import("node:path");
        const self = basename(process.cwd());
        const pkg = await ctx.fns.files.read({ path: `../${self}/package.json` });
        expect(pkg).toContain("\"name\": \"hyper-code2\"");
    });
});
