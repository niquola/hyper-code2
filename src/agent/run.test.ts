import { test, expect, describe } from "bun:test";
import start from "./start";
import stream from "./stream";
import run from "./run";
import highlight from "./highlight";
import renderMarkdown from "./renderMarkdown";
import evalFn from "../repl/eval";

const evalCodeTool = {
    name: "evalCode",
    description: "Execute a JavaScript expression or statements. Returns the serialized result.",
    parameters: {
        type: "object",
        properties: { code: { type: "string", description: "JS code to evaluate" } },
        required: ["code"],
    },
};

const mkCtx = () => ({
    state: {},
    env: { LMSTUDIO_URL: process.env.LMSTUDIO_URL, MODEL: process.env.MODEL },
    fns: {
        agent: { stream, highlight, renderMarkdown },
        repl: { eval: evalFn },
    },
} as unknown as Context);

describe("agent.run — full stateless loop (LM Studio)", () => {
    test("2 + 2 * 2 via evalCode — assistant final mentions 6", async () => {
        const ctx = mkCtx();
        const agent = start(ctx, {
            model: process.env.MODEL!,
            systemPrompt:
                "You have exactly ONE tool: `evalCode`. Use it for ANY math or code. Never compute manually.",
            tools: [evalCodeTool],
        });
        const { text } = await run(ctx, agent, "Compute 2+2*2");
        expect(text).toMatch(/6/);
    }, 120_000);

    test("agent.messages ends with assistant after loop completes", async () => {
        const ctx = mkCtx();
        const agent = start(ctx, {
            model: process.env.MODEL!,
            systemPrompt:
                "You have ONE tool: `evalCode`. Use it for ANY math. Reply with just the number.",
            tools: [evalCodeTool],
        });
        await run(ctx, agent, "3*3");
        const roles = agent.messages.map((m: any) => m.role);
        expect(roles[0]).toBe("user");
        expect(roles[roles.length - 1]).toBe("assistant");
        // sequence must be valid: user → assistant(toolCalls) → tool → assistant(text)
        expect(roles).toContain("tool");
    }, 120_000);

    test("events trace contains tool_call and assistant", async () => {
        const ctx = mkCtx();
        const agent = start(ctx, {
            model: process.env.MODEL!,
            systemPrompt: "You have ONE tool: `evalCode`. Always use it for math.",
            tools: [evalCodeTool],
        });
        await run(ctx, agent, "what is 9+1?");
        const types = agent.events.map((e: any) => e.type);
        expect(types).toContain("tool_call");
        expect(types).toContain("assistant");
        const tc = agent.events.find((e: any) => e.type === "tool_call");
        expect(tc.name).toBe("evalCode");
        expect(tc.result).toBeDefined();
    }, 120_000);

    test("context grows linearly across turns — not exponentially", async () => {
        const ctx = mkCtx();
        const agent = start(ctx, {
            model: process.env.MODEL!,
            systemPrompt: "Reply with just the number. No explanation.",
        });
        const tokens: number[] = [];
        for (let i = 1; i <= 3; i++) {
            agent.messages.push({ role: "user", content: `${i}+${i}` });
            const res = await stream(ctx, agent);
            agent.messages.push({ role: "assistant", content: res.text });
            const n = res.usage?.prompt_tokens ?? res.usage?.input_tokens;
            tokens.push(n);
        }
        // growth must not double — successive delta should be <2x prior total
        expect(tokens[1]!).toBeLessThan(tokens[0]! * 2);
        expect(tokens[2]!).toBeLessThan(tokens[1]! * 2);
    }, 120_000);
});
