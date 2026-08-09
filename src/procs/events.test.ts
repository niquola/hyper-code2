// FUNCTIONAL test: src/events.test.ts ↔ the src/events/ namespace.
// Exercises subscribe + emit + unsubscribe working together.
import { test, expect } from "bun:test";
import { testCtx } from "../$test";

const ctx = await testCtx();

test("events namespace: emit reaches live subscribers only", () => {
    const got: any[] = [];
    const off = ctx.fns.procs.events.subscribe({ handler: (e: any) => got.push(e) });
    ctx.fns.procs.events.emit({ event: { type: "ping", n: 1 } });
    off();
    ctx.fns.procs.events.emit({ event: { type: "ping", n: 2 } }); // after unsubscribe → ignored
    expect(got).toEqual([{ type: "ping", n: 1 }]);
});
