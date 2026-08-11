import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("agent.reflect", () => {
    test("starts on every third new user message and updates reflection", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:echo", systemPrompt: "" });
        for (let i = 0; i < 2; i++) await ctx.fns.session.appendUserMessage({ id: agent.id, text: `m${i}` });
        expect((await ctx.fns.agent.reflect({ agent, every: 3 })).started).toBe(false);
        await ctx.fns.session.appendUserMessage({ id: agent.id, text: "m2" });

        ctx.state.registry.agent.llmCall = async () => ({
            text: JSON.stringify({
                activity: { goal: "test reflection", currentStep: "testing", status: "verifying", nextStep: null },
                tasks: [{ title: "add tasks", status: "done", nextStep: null }],
                userSatisfaction: { level: "unknown", trend: "unknown", confidence: 0, reasons: [] },
                mistakes: [],
            }),
            finishReason: "stop", usage: null, raw: null,
        });
        expect((await ctx.fns.agent.reflect({ agent, every: 3 })).started).toBe(true);
        for (let i = 0; i < 50 && !agent.reflection; i++) await Bun.sleep(10);
        expect(agent.reflection?.reflectedUserCount).toBe(3);
        expect(agent.reflection?.state.activity.goal).toBe("test reflection");
        expect(agent.reflection?.state.tasks[0].title).toBe("add tasks");
    });
});
