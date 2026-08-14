import { describe, expect, test } from "bun:test";
import build from "./buildLlmRequest";

function ctx(provider: string): any {
    return { fns: {
        agent: {
            fullSystemPrompt: async () => "runtime instructions",
            normalizeSleepContext: () => null,
            getSleepGeneration: () => null,
        },
        session: {
            repairToolPairs: ({ messages }: any) => ({ messages, repaired: [] }),
            getMessages: async () => [], getFullMessages: async () => [],
        },
        llm: { resolveEndpoint: async () => ({ provider }) },
        procs: { log: { warn: () => {} } },
    } };
}

describe("buildLlmRequest OAuth identity", () => {
    test("managed OAuth keeps exact Claude identity in system", async () => {
        const result = await build(ctx("anthropic-oauth"), null, { agent: { model: "anthropic-oauth:claude-x", messages: [], scratchpad: {} } as any });
        expect(result.system).toBe("You are Claude Code, Anthropic's official CLI for Claude.");
        expect(result.messages[0].content).toBe("runtime instructions");
    });

    test("API-key Anthropic keeps system-as-messages policy", async () => {
        const result = await build(ctx("anthropic"), null, { agent: { model: "anthropic:claude-x", messages: [], scratchpad: {} } as any });
        expect(result.system).toBe("");
        expect(result.messages[0].content).toBe("runtime instructions");
    });
});
