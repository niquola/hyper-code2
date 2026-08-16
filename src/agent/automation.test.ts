import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("agent automation flags", () => {
    test("disable guards reflection and sleep and returns active sleep to full history", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        agent.sleepContext = { mode: "compact", activeRevision: 1, draftRevision: null, generations: [{ revision: 1 }] };
        await ctx.fns.procs.db.run({ sql: "UPDATE agents SET sleep_context = ?::jsonb WHERE id = ?", params: [JSON.stringify(agent.sleepContext), agent.id] });
        expect(await ctx.fns.agent.setAutomation({ id: agent.id, reflectionEnabled: false, sleepEnabled: false })).toEqual({ reflectionEnabled: false, sleepEnabled: false, functionRagEnabled: false });
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

    test("new agents start with reflection and sleep off, opt-in works", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        expect(agent.reflectionEnabled).toBe(false);
        expect(agent.sleepEnabled).toBe(false);
        expect(await ctx.fns.agent.reflect({ agent, every: 1 })).toEqual({ started: false, reason: "disabled" });
        expect(await ctx.fns.agent.sleep({ agent, force: true })).toEqual({ started: false, reason: "disabled" });
        delete ctx.state.agent[agent.id];
        const loaded = await ctx.fns.session.load({ id: agent.id });
        expect(loaded?.reflectionEnabled).toBe(false);
        expect(loaded?.sleepEnabled).toBe(false);
        await ctx.fns.agent.setAutomation({ id: agent.id, reflectionEnabled: true, sleepEnabled: true });
        delete ctx.state.agent[agent.id];
        const reloaded = await ctx.fns.session.load({ id: agent.id });
        expect(reloaded?.reflectionEnabled).toBe(true);
        expect(reloaded?.sleepEnabled).toBe(true);
    });

    test("undefined flags leave the stored values untouched", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.agent.setAutomation({ id: agent.id, sleepEnabled: true });
        // Toggling only reflection must not reset sleep.
        await ctx.fns.agent.setAutomation({ id: agent.id, reflectionEnabled: true });
        const row = ((await ctx.fns.procs.db.select({ sql: "SELECT reflection_enabled, sleep_enabled FROM agents WHERE id = ?", params: [agent.id] })) as any[])[0];
        expect(row.reflection_enabled).toBe(true);
        expect(row.sleep_enabled).toBe(true);
    });
});
