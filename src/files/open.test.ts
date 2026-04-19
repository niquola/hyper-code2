import { test, expect, describe } from "bun:test";
import open from "./open";
import close from "./close";
import listOpen from "./listOpen";

const mkCtx = () => ({ state: {}, env: {}, fns: {} as any, routes: {} }) as unknown as Context;

describe("files.open / close / listOpen", () => {
    test("open adds path and is idempotent", () => {
        const ctx = mkCtx();
        open(ctx, "README.md");
        open(ctx, "README.md");
        open(ctx, "src/$main.ts");
        expect(listOpen(ctx)).toEqual(["README.md", "src/$main.ts"]);
    });

    test("close removes path", () => {
        const ctx = mkCtx();
        open(ctx, "a");
        open(ctx, "b");
        close(ctx, "a");
        expect(listOpen(ctx)).toEqual(["b"]);
    });

    test("empty path is ignored by open", () => {
        const ctx = mkCtx();
        open(ctx, "");
        expect(listOpen(ctx)).toEqual([]);
    });

    test("listOpen on fresh ctx returns []", () => {
        expect(listOpen(mkCtx())).toEqual([]);
    });
});
