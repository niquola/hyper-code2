import { test, expect, describe } from "bun:test";
import start from "../agent/start";
import stream from "./streamOpenAI";
import resolveEndpoint from "./resolveEndpoint";
import fullSystemPrompt from "../agent/fullSystemPrompt";
import buildLlmRequest from "../agent/buildLlmRequest";

// Exercises streamOpenAI directly, bypassing the stream.ts dispatcher.
const mkCtx = () => ({
    state: {},
    env: { LMSTUDIO_URL: process.env.LMSTUDIO_URL, MODEL: process.env.MODEL },
    fns: { llm: { resolveEndpoint }, agent: { fullSystemPrompt, buildLlmRequest } },
} as unknown as Context);

// Live integration with LM Studio at process.env.LMSTUDIO_URL.
// Skipped by default — opt in with LIVE_LLM=1 bun test ./src/llm/streamOpenAI.test.ts.
// Per CLAUDE.md, the regular test suite must use mock:* models via streamMock.
describe.skipIf(!process.env.LIVE_LLM)("agent.stream — stateless /v1/chat/completions (LM Studio)", () => {
    test("env loaded from .env.test", () => {
        expect(process.env.LMSTUDIO_URL).toBe("http://localhost:1234");
        expect(process.env.MODEL).toBeDefined();
    });

    test("plain text reply", async () => {
        const ctx = mkCtx();
        const agent = start(ctx, {
            model: process.env.MODEL!,
            systemPrompt: "Reply in one short sentence.",
        });
        agent.messages.push({ role: "user", content: "say hi" });
        const result = await stream(ctx, { agent });
        expect(result.text.length).toBeGreaterThan(0);
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
        const result = await stream(ctx, {
            agent,
            onEvent: (ev) => { if (ev.type === "text_delta") deltas.push(ev.delta); },
        });
        expect(deltas.length).toBeGreaterThan(0);
        expect(deltas.join("")).toBe(result.text);
    }, 60_000);

});
