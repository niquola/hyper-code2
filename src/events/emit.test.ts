import { test, expect, describe } from "bun:test";
import emit from "./emit";
import subscribe from "./subscribe";

const mkCtx = () => ({ state: {}, env: {}, fns: {} as any, routes: {} }) as unknown as Context;

describe("events.emit / subscribe", () => {
    test("delivers events to all subscribers", () => {
        const ctx = mkCtx();
        const a: any[] = [], b: any[] = [];
        subscribe(ctx, e => a.push(e));
        subscribe(ctx, e => b.push(e));
        emit(ctx, { type: "x", v: 1 });
        emit(ctx, { type: "y", v: 2 });
        expect(a).toEqual([{ type: "x", v: 1 }, { type: "y", v: 2 }]);
        expect(b).toEqual([{ type: "x", v: 1 }, { type: "y", v: 2 }]);
    });

    test("unsubscribe stops delivery", () => {
        const ctx = mkCtx();
        const got: any[] = [];
        const off = subscribe(ctx, e => got.push(e));
        emit(ctx, 1);
        off();
        emit(ctx, 2);
        expect(got).toEqual([1]);
    });

    test("throwing subscriber doesn't break others", () => {
        const ctx = mkCtx();
        const got: any[] = [];
        subscribe(ctx, () => { throw new Error("boom"); });
        subscribe(ctx, e => got.push(e));
        emit(ctx, "ok");
        expect(got).toEqual(["ok"]);
    });

    test("emit without subscribers is a no-op", () => {
        const ctx = mkCtx();
        expect(() => emit(ctx, { type: "nothing" })).not.toThrow();
    });
});
