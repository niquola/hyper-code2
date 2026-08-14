import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("durable agent wake-up", () => {
    test("schedules, delivers visible message, and queues run", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        const now = Date.now();
        const scheduled = await ctx.fns.agent.wakeAt({ id: agent.id, at: now + 1000, reason: "check build" });
        expect(scheduled.reason).toBe("check build");
        expect(agent.wakeAt).toBe(now + 1000);
        expect((await ctx.fns.agent.deliverWakes({ now: now + 1001 })).delivered).toEqual([agent.id]);
        const row = (await ctx.fns.procs.db.select({ sql: "SELECT wake_at, wake_reason, next_run_at FROM agents WHERE id = ?", params: [agent.id] }))[0];
        expect(row.wake_at).toBeNull();
        expect(row.wake_reason).toBeNull();
        expect(row.next_run_at).not.toBeNull();
        const messages = await ctx.fns.session.getMessages({ id: agent.id });
        expect(messages.at(-1)).toMatchObject({ role: "user", message_type: "wake_up", excluded_from_cursor: true });
        expect(messages.at(-1).content).toContain("check build");
        expect((await ctx.fns.session.getEvents({ id: agent.id })).at(-1)).toMatchObject({ type: "wake_up", reason: "check build" });
    });

    test("cancel clears alarm", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.agent.wakeIn({ id: agent.id, delayMs: 60_000, reason: "later" });
        expect((await ctx.fns.agent.cancelWake({ id: agent.id })).cancelled).toBe(true);
        expect(agent.wakeAt).toBeNull();
        expect((await ctx.fns.agent.cancelWake({ id: agent.id })).cancelled).toBe(false);
    });
});
