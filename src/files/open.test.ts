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

// files.rgPath caches the ripgrep lookup under the SAME ctx.state.files
// namespace, so after any grep the namespace exists without an `open` list.
// open/close read straight through it and used to throw on `s.open.includes`,
// which took the whole /files page down with it.
describe("files.open — state shared with rgPath", () => {
    test("open works after a grep has claimed ctx.state.files", async () => {
        const ctx = await mkTestCtx();
        ctx.fns.files.rgPath({});
        expect(() => ctx.fns.files.open({ path: "README.md" })).not.toThrow();
        expect(ctx.fns.files.listOpen({})).toEqual(["README.md"]);
    });

    test("close works after a grep has claimed ctx.state.files", async () => {
        const ctx = await mkTestCtx();
        ctx.fns.files.rgPath({});
        expect(() => ctx.fns.files.close({ path: "nothing" })).not.toThrow();
        expect(ctx.fns.files.listOpen({})).toEqual([]);
    });

    test("the file page still renders when a grep came first", async () => {
        const ctx = await mkTestCtx();
        ctx.fns.files.rgPath({});
        const res = await ctx.fns.procs.http.dispatch({ url: "/files?path=README.md" });
        expect(res.status).toBe(200);
    });
});
