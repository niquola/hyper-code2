import { describe, expect, test } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("agent status line", () => {
    test("activates on configured user turns", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.agent.setStatusLine({ id: agent.id, text: "be brief", every: 2, mode: "custom" });
        await ctx.fns.session.appendUserMessage({ id: agent.id, text: "one" });
        expect(await ctx.fns.agent.statusLineForTurn({ agent })).toBe("");
        await ctx.fns.session.appendUserMessage({ id: agent.id, text: "two" });
        expect(await ctx.fns.agent.statusLineForTurn({ agent })).toBe("User status line: be brief");
    });


    test("inherits the global line every turn and supports off", async () => {
        const ctx: any = await mkTestCtx();
        await ctx.fns.settings.set({ module: "agent", scopeType: "global", key: "globalStatusLine", value: "answer briefly" });
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        await ctx.fns.session.appendUserMessage({ id: agent.id, text: "one" });
        expect(await ctx.fns.agent.statusLineForTurn({ agent })).toBe("User status line: answer briefly");
        await ctx.fns.agent.setStatusLine({ id: agent.id, text: "", mode: "off" });
        expect(await ctx.fns.agent.statusLineForTurn({ agent })).toBe("");
    });
    test("adds a reflection nudge until its TTL expires", async () => {
        const ctx: any = await mkTestCtx();
        const agent = await ctx.fns.agent.start({ model: "mock:test" });
        agent.reflection = { reflectedUserCount: 1, state: { reflectionNudge: { text: "verify before answering", createdAtUserCount: 1, expiresAfterTurns: 2 } } };
        await ctx.fns.session.appendUserMessage({ id: agent.id, text: "one" });
        expect(await ctx.fns.agent.statusLineForTurn({ agent })).toContain("Reflection nudge: verify before answering");
        await ctx.fns.session.appendUserMessage({ id: agent.id, text: "two" });
        await ctx.fns.session.appendUserMessage({ id: agent.id, text: "three" });
        expect(await ctx.fns.agent.statusLineForTurn({ agent })).toContain("Reflection nudge");
        await ctx.fns.session.appendUserMessage({ id: agent.id, text: "four" });
        expect(await ctx.fns.agent.statusLineForTurn({ agent })).toBe("");
    });
});
