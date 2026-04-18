import { test, expect, describe } from "bun:test";
import start from "../agent/start";
import stream from "./stream";
import resolveEndpoint from "./resolveEndpoint";

const mkCtx = () => ({
    state: {},
    env: { LMSTUDIO_URL: process.env.LMSTUDIO_URL, MODEL: process.env.MODEL },
    fns: { ai: { resolveEndpoint } },
} as unknown as Context);

describe("agent.stream — stateless /v1/chat/completions (LM Studio)", () => {
    test("env loaded from .env.test", () => {
        expect(process.env.LMSTUDIO_URL).toBe("http://localhost:1234");
        expect(process.env.MODEL).toBeDefined();
    });

    test("plain text reply — no tool calls", async () => {
        const ctx = mkCtx();
        const agent = start(ctx, {
            model: process.env.MODEL!,
            systemPrompt: "Reply in one short sentence.",
        });
        agent.messages.push({ role: "user", content: "say hi" });
        const result = await stream(ctx, agent);
        expect(result.text.length).toBeGreaterThan(0);
        expect(result.toolCalls).toEqual([]);
        expect(result.usage?.prompt_tokens ?? result.usage?.input_tokens).toBeGreaterThan(0);
    }, 60_000);

    test("emits text_delta via onEvent callback", async () => {
        const ctx = mkCtx();
        const agent = start(ctx, {
            model: process.env.MODEL!,
            systemPrompt: "Reply in one short sentence.",
        });
        agent.messages.push({ role: "user", content: "pick a number 1-9" });
        const deltas: string[] = [];
        const result = await stream(ctx, agent, {
            onEvent: (ev) => { if (ev.type === "text_delta") deltas.push(ev.delta); },
        });
        expect(deltas.length).toBeGreaterThan(0);
        expect(deltas.join("")).toBe(result.text);
    }, 60_000);

    test("invokes tool — returns toolCalls with parsed name/args", async () => {
        const ctx = mkCtx();
        const agent = start(ctx, {
            model: process.env.MODEL!,
            systemPrompt: "You have ONE tool: `evalCode`. Use it for any math. Never compute manually.",
            tools: [{
                name: "evalCode",
                description: "Execute JS; returns serialized result.",
                parameters: {
                    type: "object",
                    properties: { code: { type: "string" } },
                    required: ["code"],
                },
            }],
        });
        agent.messages.push({ role: "user", content: "compute 3+4*5" });
        const result = await stream(ctx, agent);
        expect(result.toolCalls.length).toBeGreaterThan(0);
        const tc = result.toolCalls[0]!;
        expect(tc.name).toBe("evalCode");
        const args = JSON.parse(tc.arguments);
        expect(args.code).toMatch(/3.*4.*5/);
        expect(result.finishReason).toBe("tool_calls");
    }, 60_000);
});
