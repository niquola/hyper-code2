import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("session.removePlan", () => {
    test("archives the current plan by default", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.session.plan({ agent, title: "One", tasks: [{ id: "a", title: "A" }] });
        const result = await ctx.fns.session.removePlan({ agent });
        expect(result).toEqual({ ok: true, archived: true });
        expect(agent.scratchpad.plan).toBeUndefined();
        expect(agent.scratchpad.planHistory[0].title).toBe("One");
    });

    test("can permanently delete without history", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.session.plan({ agent, tasks: [{ id: "a", title: "A" }] });
        await ctx.fns.session.removePlan({ agent, archive: false });
        expect(agent.scratchpad.plan).toBeUndefined();
        expect(agent.scratchpad.planHistory).toBeUndefined();
    });

    test("archive freezes the active task timer", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.session.plan({ agent, tasks: [{ id: "a", title: "A" }] });
        agent.scratchpad.plan.tasks[0].activeSince = Date.now() - 1000;
        await ctx.fns.session.updateScratchpad({ id: agent.id, scratchpad: agent.scratchpad });
        await ctx.fns.session.removePlan({ agent });
        const archived = agent.scratchpad.planHistory[0].tasks[0];
        expect(archived.activeSince).toBeNull();
        expect(archived.elapsedMs).toBeGreaterThanOrEqual(900);
    });

});
