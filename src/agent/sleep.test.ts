import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("agent.sleep", () => {
    test("builds immutable drafts, explicitly switches, and keeps active generation while newer draft waits", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        for (let i = 0; i < 5; i++) {
            await ctx.fns.session.appendUserMessage({ id: agent.id, text: `question ${i}` });
            await ctx.fns.session.appendAssistantMessage({ id: agent.id, msg: { content: `answer ${i}` } });
        }
        ctx.state.registry.agent.llmCall = async () => ({ text: JSON.stringify({
            situation: "testing sleep", requirements: ["keep facts"], decisionsAndFacts: ["decision"],
            workLog: ["tests ran"], openWork: ["activate"], mistakesToAvoid: ["do not delete"], nextStep: "activate",
        }) });

        expect((await ctx.fns.agent.sleep({ agent, force: true, tailUserTurns: 2 })).started).toBe(true);
        for (let i = 0; i < 100 && !agent.sleepContext; i++) await Bun.sleep(10);
        expect(agent.sleepContext.mode).toBe("full");
        expect(agent.sleepContext.draftRevision).toBe(1);
        expect(agent.sleepContext.generations).toHaveLength(1);

        const full = await ctx.fns.session.getFullMessages({ id: agent.id });
        await ctx.fns.agent.setSleepActive({ id: agent.id, active: true, revision: 1 });
        await ctx.fns.session.syncAgentState({ agent });
        const sleeping = await ctx.fns.agent.buildLlmRequest({ agent });
        expect(sleeping.messages.some((m: any) => m.message_type === "consolidated_session")).toBe(true);
        expect(sleeping.messages.length).toBeLessThan(full.length + 2);

        await ctx.fns.session.appendUserMessage({ id: agent.id, text: "new tail" });
        await ctx.fns.session.syncAgentState({ agent });
        expect((await ctx.fns.agent.sleep({ agent, force: true })).started).toBe(true);
        for (let i = 0; i < 100 && agent.sleepContext?.draftRevision !== 2; i++) await Bun.sleep(10);
        expect(agent.sleepContext.activeRevision).toBe(1);
        expect(agent.sleepContext.draftRevision).toBe(2);
        expect(agent.sleepContext.generations).toHaveLength(2);

        const stillV1 = await ctx.fns.agent.buildLlmRequest({ agent });
        expect(stillV1.messages.some((m: any) => String(m.content).includes("testing sleep"))).toBe(true);
        await ctx.fns.agent.setSleepActive({ id: agent.id, active: true, revision: 2 });
        expect(agent.sleepContext.activeRevision).toBe(2);
        expect(agent.sleepContext.draftRevision).toBeNull();

        await ctx.fns.agent.setSleepActive({ id: agent.id, active: false });
        const awake = await ctx.fns.agent.buildLlmRequest({ agent });
        expect(awake.messages.slice(-agent.messages.length).map((m: any) => m.content)).toEqual(agent.messages.map((m: any) => m.content));
    });
});
