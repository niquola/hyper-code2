import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import open from "./open";

describe("files.open broadcasts SSE events", () => {
    test("open emits {type:'files.open', path}", async () => {
        const ctx = await mkTestCtx();
        const events: any[] = [];
        ctx.fns.procs.events.subscribe({ handler: (e: any) => events.push(e) });
        ctx.fns.files.open({ path: "README.md" });
        expect(events).toEqual([{ type: "files.open", path: "README.md" }]);
    });

    test("close emits {type:'files.close', path}", async () => {
        const ctx = await mkTestCtx();
        ctx.fns.files.open({ path: "README.md" });
        const events: any[] = [];
        ctx.fns.procs.events.subscribe({ handler: (e: any) => events.push(e) });
        ctx.fns.files.close({ path: "README.md" });
        expect(events).toEqual([{ type: "files.close", path: "README.md" }]);
    });

    test("emit is optional — open works even if events module is absent", () => {
        const ctx = { state: {}, env: {}, fns: {} as any } as unknown as Context;
        expect(() => open(ctx, null, { path: "x" })).not.toThrow();
    });
});
