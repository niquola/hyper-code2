import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("files.open / close / listOpen", () => {
    test("open adds path and is idempotent", async () => {
        const ctx = await mkTestCtx();
        ctx.fns.files.open({ path: "README.md" });
        ctx.fns.files.open({ path: "README.md" });
        ctx.fns.files.open({ path: "src/$main.ts" });
        expect(ctx.fns.files.listOpen({})).toEqual(["README.md", "src/$main.ts"]);
    });

    test("close removes path", async () => {
        const ctx = await mkTestCtx();
        ctx.fns.files.open({ path: "a" });
        ctx.fns.files.open({ path: "b" });
        ctx.fns.files.close({ path: "a" });
        expect(ctx.fns.files.listOpen({})).toEqual(["b"]);
    });

    test("empty path is ignored by open", async () => {
        const ctx = await mkTestCtx();
        ctx.fns.files.open({ path: "" });
        expect(ctx.fns.files.listOpen({})).toEqual([]);
    });

    test("listOpen on fresh ctx returns []", async () => {
        const ctx = await mkTestCtx();
        expect(ctx.fns.files.listOpen({})).toEqual([]);
    });
});
