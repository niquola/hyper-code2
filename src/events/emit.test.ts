import { test, expect, describe } from "bun:test";
import emit from "./emit";
import subscribe from "./subscribe";

const mkCtx = () => ({ state: {}, env: {}, fns: {} as any, routes: {} }) as unknown as Context;

describe("events.emit / subscribe", () => {
    test("delivers events to all subscribers", () => {
        const ctx = mkCtx();
        const a: any[] = [], b: any[] = [];
        subscribe(ctx, { handler: e => a.push(e) });
        subscribe(ctx, { handler: e => b.push(e) });
        emit(ctx, { event: { type: "x", v: 1 } });
        emit(ctx, { event: { type: "y", v: 2 } });
        expect(a).toEqual([{ type: "x", v: 1 }, { type: "y", v: 2 }]);
        expect(b).toEqual([{ type: "x", v: 1 }, { type: "y", v: 2 }]);
    });

    test("unsubscribe stops delivery", () => {
        const ctx = mkCtx();
        const got: any[] = [];
        const off = subscribe(ctx, { handler: e => got.push(e) });
        emit(ctx, { event: 1 });
        off();
        emit(ctx, { event: 2 });
        expect(got).toEqual([1]);
    });

    test("throwing subscriber doesn't break others", () => {
        const ctx = mkCtx();
        const got: any[] = [];
        subscribe(ctx, { handler: () => { throw new Error("boom"); } });
        subscribe(ctx, { handler: e => got.push(e) });
        emit(ctx, { event: "ok" });
        expect(got).toEqual(["ok"]);
    });

    test("emit without subscribers is a no-op", () => {
        const ctx = mkCtx();
        expect(() => emit(ctx, { event: { type: "nothing" } })).not.toThrow();
    });
});
