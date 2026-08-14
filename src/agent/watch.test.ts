import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("wakeUpWhen", () => {
    test("wakes with predicate result", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        ctx.state.registry.agent.watchPredicate = async () => ({ ready: true, result: { ok: 42 } });
        const watch = await ctx.fns.agent.wakeUpWhen({ id: agent.id, predicate: "file.exists", opts: { path: "x" }, reason: "wait for x", everyMs: 5000, timeoutMs: 60_000 });
        expect((await ctx.fns.agent.pollWatches({ now: watch.nextCheckAt })).processed).toEqual([watch.watchId]);
        for (let i = 0; i < 50; i++) {
            const current = (await ctx.fns.agent.listWatches({ id: agent.id, activeOnly: false }))[0];
            if (current?.status === "completed") break;
            await Bun.sleep(5);
        }
        const rows = await ctx.fns.agent.listWatches({ id: agent.id, activeOnly: false });
        expect(rows[0].status).toBe("completed");
        const msg = (await ctx.fns.session.getMessages({ id: agent.id })).at(-1);
        expect(msg.content).toContain('"ok":42');
        expect(msg.message_type).toBe("wake_up");
    });

    test("reschedules false predicate and then times out", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        ctx.state.registry.agent.watchPredicate = async () => ({ ready: false });
        const watch = await ctx.fns.agent.wakeUpWhen({ id: agent.id, predicate: "http.ok", opts: { url: "https://example.test" }, reason: "wait", everyMs: 5000, timeoutMs: 5000 });
        expect((await ctx.fns.agent.deliverWatch({ watchId: watch.watchId, now: watch.nextCheckAt })).status).toBe("waiting");
        expect((await ctx.fns.agent.deliverWatch({ watchId: watch.watchId, now: watch.timeoutAt + 1 })).status).toBe("timeout");
        expect((await ctx.fns.session.getMessages({ id: agent.id })).at(-1).content).toContain("timed out");
    });

    test("cancel prevents delivery", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        const watch = await ctx.fns.agent.wakeUpWhen({ id: agent.id, predicate: "file.exists", opts: { path: "x" }, reason: "wait" });
        expect((await ctx.fns.agent.cancelWatch({ id: agent.id, watchId: watch.watchId })).cancelled).toBe(true);
        expect((await ctx.fns.agent.deliverWatch({ watchId: watch.watchId })).status).toBe("missing");
    });
    test("atomic claim prevents duplicate delivery", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        ctx.state.registry.agent.watchPredicate = async () => ({ ready: true, result: { once: true } });
        const watch = await ctx.fns.agent.wakeUpWhen({ id: agent.id, predicate: "file.exists", opts: { path: "x" }, reason: "once", everyMs: 5000, timeoutMs: 60_000 });
        await Promise.all([
            ctx.fns.agent.deliverWatch({ watchId: watch.watchId, now: watch.nextCheckAt }),
            ctx.fns.agent.deliverWatch({ watchId: watch.watchId, now: watch.nextCheckAt }),
        ]);
        const events = (await ctx.fns.session.getEvents({ id: agent.id })).filter((e: any) => e.type === "wake_up" && e.watchId === watch.watchId);
        expect(events).toHaveLength(1);
    });

    test("large results are compacted before transcript delivery", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        ctx.state.registry.agent.watchPredicate = async () => ({ ready: true, result: { blob: "x".repeat(30_000) } });
        const watch = await ctx.fns.agent.wakeUpWhen({ id: agent.id, predicate: "file.exists", opts: { path: "x" }, reason: "large", everyMs: 5000, timeoutMs: 60_000 });
        const result: any = await ctx.fns.agent.deliverWatch({ watchId: watch.watchId, now: watch.nextCheckAt });
        expect(result.result.truncated).toBe(true);
        expect(JSON.stringify(result.result).length).toBeLessThan(17_000);
    });

    test("runtime.fn invokes any registered function with args", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        ctx.state.registry.tmp ??= {};
        ctx.state.registry.tmp.probe = async (_ctx: any, _session: any, opts: any) => ({ ready: opts.value === 42, result: { value: opts.value } });
        const watch = await ctx.fns.agent.wakeUpWhen({ id: agent.id, predicate: "runtime.fn", opts: { name: "tmp.probe", args: { value: 42 } }, reason: "runtime ready", everyMs: 5000, timeoutMs: 60_000 });
        const result = await ctx.fns.agent.deliverWatch({ watchId: watch.watchId, now: watch.nextCheckAt });
        expect(result).toEqual({ status: "ready", result: { value: 42 } });
    });


});
