import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("agent automation flags", () => {
    test("disable guards reflection and sleep and returns active sleep to full history", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        agent.sleepContext = { mode: "compact", activeRevision: 1, draftRevision: null, generations: [{ revision: 1 }] };
        await ctx.fns.procs.db.run({ sql: "UPDATE agents SET sleep_context = ?::jsonb WHERE id = ?", params: [JSON.stringify(agent.sleepContext), agent.id] });
        expect(await ctx.fns.agent.setAutomation({ id: agent.id, reflectionEnabled: false, sleepEnabled: false })).toEqual({ reflectionEnabled: false, sleepEnabled: false });
        expect(agent.sleepContext.mode).toBe("full");
        expect(await ctx.fns.agent.reflect({ agent, every: 1 })).toEqual({ started: false, reason: "disabled" });
        expect(await ctx.fns.agent.sleep({ agent, force: true })).toEqual({ started: false, reason: "disabled" });
    });

    test("flags survive reload", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.agent.setAutomation({ id: agent.id, reflectionEnabled: false, sleepEnabled: true });
        delete ctx.state.agent[agent.id];
        const loaded = await ctx.fns.session.load({ id: agent.id });
        expect(loaded?.reflectionEnabled).toBe(false);
        expect(loaded?.sleepEnabled).toBe(true);
    });
});
