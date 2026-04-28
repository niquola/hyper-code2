import { test, expect, describe } from "bun:test";
import loadFns from "./loadFns";
import roots from "./project/roots";
import scan from "./project/scan";

describe("loadFns", () => {
    test("loads root and namespaced functions via project scanner", async () => {
        const ctx = { fns: { project: { roots, scan } }, routes: {}, state: {} } as unknown as Context;
        await loadFns(ctx);
        expect((ctx as any).genTypes).toBeTypeOf("function");
        expect((ctx.fns as any).db.connect).toBeTypeOf("function");
        expect((ctx.fns as any).agent.run).toBeTypeOf("function");
    });
});
