import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("agent.setGoalTracking", () => {
    test("persists an opt-in flag per agent", async () => {
        const ctx: any = await mkTestCtx();
        const first = await ctx.fns.agent.start({ model: "mock:test" });
        const second = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.agent.setGoalTracking({ id: first.id, enabled: true });
        expect(first.scratchpad.goalTrackingEnabled).toBe(true);
        expect(second.scratchpad.goalTrackingEnabled).toBeUndefined();
        const loaded = await ctx.fns.session.load({ id: first.id });
        expect(loaded.scratchpad.goalTrackingEnabled).toBe(true);
        await ctx.fns.agent.setGoalTracking({ id: first.id, enabled: false });
        expect(first.scratchpad.goalTrackingEnabled).toBe(false);
    });
});
