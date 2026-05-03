import { test, expect, describe } from "bun:test";
import open from "./open";
import close from "./close";
import listOpen from "./listOpen";

const mkCtx = () => ({ state: {}, env: {}, fns: {} as any, routes: {} }) as unknown as Context;

describe("files.open / close / listOpen", () => {
    test("open adds path and is idempotent", () => {
        const ctx = mkCtx();
        open(ctx, { path: "README.md" });
        open(ctx, { path: "README.md" });
        open(ctx, { path: "src/$main.ts" });
        expect(listOpen(ctx)).toEqual(["README.md", "src/$main.ts"]);
    });

    test("close removes path", () => {
        const ctx = mkCtx();
        open(ctx, { path: "a" });
        open(ctx, { path: "b" });
        close(ctx, { path: "a" });
        expect(listOpen(ctx)).toEqual(["b"]);
    });

    test("empty path is ignored by open", () => {
        const ctx = mkCtx();
        open(ctx, { path: "" });
        expect(listOpen(ctx)).toEqual([]);
    });

    test("listOpen on fresh ctx returns []", () => {
        expect(listOpen(mkCtx())).toEqual([]);
    });
});
