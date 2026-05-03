import { test, expect, describe, mock } from "bun:test";
import start from "./start";

const mkCtx = () => {
    const save = mock(() => {});
    const emitAgentsChanged = mock(() => {});
    const nextId = mock(() => 'a');
    return {
        state: {},
        env: process.env,
        fns: {
            agent: { nextId },
            session: { save },
            events: { emitAgentsChanged },
        },
    } as unknown as Context;
};

describe("agent.start", () => {
    test("creates agent with default shape", () => {
        const ctx = mkCtx();
        const agent = start(ctx, { model: "minimax/minimax-m2.7" });
        expect(agent.id).toBe('a');
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
        (ctx as any).fns.agent.nextId
            .mockReturnValueOnce('a')
            .mockReturnValueOnce('b');
        const a = start(ctx, { model: "x" });
        const b = start(ctx, { model: "y" });
        expect(a.id).not.toBe(b.id);
        expect(Object.keys((ctx.state as any).agent)).toHaveLength(2);
    });

    test("persists and emits create event", () => {
        const ctx = mkCtx() as any;
        const agent = start(ctx, { model: "codex:gpt-5.4" });
        expect(ctx.fns.agent.nextId).toHaveBeenCalledTimes(1);
        expect(ctx.fns.session.save).toHaveBeenCalledTimes(1);
        expect(ctx.fns.session.save).toHaveBeenCalledWith(ctx, { agent });
        expect(ctx.fns.events.emitAgentsChanged).toHaveBeenCalledTimes(1);
        expect(ctx.fns.events.emitAgentsChanged).toHaveBeenCalledWith(ctx, { agentId: agent.id, reason: "create" });
    });
});
