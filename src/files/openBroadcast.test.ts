import { test, expect, describe } from "bun:test";
import loadFns from "../loadFns";
import open from "./open";
import close from "./close";

const mkCtx = async () => {
    const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
    await loadFns(ctx);
    return ctx;
};

describe("files.open broadcasts SSE events", () => {
    test("open emits {type:'files.open', path}", async () => {
        const ctx = await mkCtx();
        const events: any[] = [];
        ctx.fns.events.subscribe(ctx, { handler: e => events.push(e) });
        open(ctx, { path: "README.md" });
        expect(events).toEqual([{ type: "files.open", path: "README.md" }]);
    });

    test("close emits {type:'files.close', path}", async () => {
        const ctx = await mkCtx();
        open(ctx, { path: "README.md" });
        const events: any[] = [];
        ctx.fns.events.subscribe(ctx, { handler: e => events.push(e) });
        close(ctx, { path: "README.md" });
        expect(events).toEqual([{ type: "files.close", path: "README.md" }]);
    });

    test("emit is optional — open works even if events module is absent", () => {
        const ctx = { state: {}, env: {}, fns: {} as any, routes: {} } as unknown as Context;
        expect(() => open(ctx, { path: "x" })).not.toThrow();
    });
});
