import { test, expect, describe } from "bun:test";
import start from "./start";

const mkCtx = () => ({ state: {}, env: process.env } as unknown as Context);

describe("agent.start", () => {
    test("creates agent with default shape", () => {
        const ctx = mkCtx();
        const agent = start(ctx, { model: "minimax/minimax-m2.7" });
        expect(agent.id).toMatch(/^agent_/);
        expect(agent.model).toBe("minimax/minimax-m2.7");
        expect(agent.systemPrompt).toBe("");
        expect(agent.messages).toEqual([]);
        expect(agent.events).toEqual([]);
        expect(agent.scratchpad).toEqual({});
        expect(agent.isStreaming).toBe(false);
    });

    test("stores agent in ctx.state.agent[id]", () => {
        const ctx = mkCtx();
        const agent = start(ctx, { model: "x", systemPrompt: "hi" });
        expect((ctx.state as any).agent[agent.id]).toBe(agent);
        expect(agent.systemPrompt).toBe("hi");
    });

    test("multiple agents coexist", () => {
        const ctx = mkCtx();
        const a = start(ctx, { model: "x" });
        const b = start(ctx, { model: "y" });
        expect(a.id).not.toBe(b.id);
        expect(Object.keys((ctx.state as any).agent)).toHaveLength(2);
    });
});
