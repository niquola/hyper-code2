import { expect, test } from "bun:test";
import { testCtx } from "../../$test";

const ctx: any = await testCtx();

test("safeSpan is transparent when telemetry is unavailable", async () => {
    expect(await ctx.fns.procs.telemetry.safeSpan({ name: "x", fn: async () => 42 })).toBe(42);
});

test("span preserves sync return and records", () => {
    const records: any[] = [];
    ctx.state.procs.telemetry = {
        enabled: true, slowMs: 100, maxRecent: 10, recent: [], active: new Map(),
        buffer: [], flushChain: Promise.resolve(), dropped: 0,
        als: new (require("node:async_hooks").AsyncLocalStorage)(), file: "/tmp/nope",
    };
    const original = ctx.state.registry.procs.telemetry.record;
    ctx.state.registry.procs.telemetry.record = (_ctx: any, _session: any, opts: any) => records.push(opts);
    try {
        expect(ctx.fns.procs.telemetry.span({ name: "sync", fn: () => 7 })).toBe(7);
        expect(records).toHaveLength(1);
    } finally { ctx.state.registry.procs.telemetry.record = original; }
});
