import { describe, test, expect } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";
import run from "./run";

const evalCodeTool = {
    name: "evalCode",
    description: "Execute a JavaScript expression or statements. Returns the serialized result.",
    parameters: {
        type: "object",
        properties: { code: { type: "string", description: "JS code to evaluate" } },
        required: ["code"],
    },
};

describe("agent.run with mock llm", () => {
    test("echoes a user message through mock provider", async () => {
        const ctx = await mkTestCtx();
        const agent = ctx.fns.agent.start(ctx, { model: 'mock:echo', systemPrompt: '', tools: [] });
        agent.scratchpad.mockLLM = { echoUser: true };
        ctx.fns.session.save(ctx, agent);
        const res = await run(ctx, agent, 'hello mock');
        expect(res.text).toBe('hello mock');
    });

    test("runs tool loop through mock provider", async () => {
        const ctx = await mkTestCtx();
        const agent = ctx.fns.agent.start(ctx, { model: 'mock:tool', systemPrompt: '', tools: [evalCodeTool] });
        agent.scratchpad.mockLLM = { userToolCode: '2+2', afterToolText: '4' };
        ctx.fns.session.save(ctx, agent);
        const res = await run(ctx, agent, 'calc');
        expect(res.text).toBe('4');
    });

    test("fork child sees inherited parent messages via mock provider", async () => {
        const ctx = await mkTestCtx();
        const parent = ctx.fns.agent.start(ctx, { model: 'mock:echo', systemPrompt: '', tools: [] });
        ctx.fns.session.save(ctx, parent);
        ctx.fns.session.appendMessage(ctx, parent.id, { role: 'user', content: 'parent says hi' });
        const child = ctx.fns.agent.start(ctx, { model: 'mock:echo', systemPrompt: '', tools: [], parentId: parent.id, forkOffset: 1 });
        child.scratchpad.mockLLM = { echoUser: true };
        ctx.fns.session.save(ctx, child);
        const full = ctx.fns.session.getFullMessages(ctx, child.id);
        expect(full[0].content).toBe('parent says hi');
    });
});
