import { describe, expect, test } from "bun:test";
import capabilities from "./reasoningCapabilities";
import resolve from "./resolveReasoningEffort";

const ctx: any = { fns: { llm: { reasoningCapabilities: (o:any) => capabilities(ctx, null, o) } } };

describe("reasoning effort policy", () => {
    test("Codex supports effort and defaults to medium", async () => {
        const caps = await capabilities(ctx, null, { model: "codex/persona:gpt-5.6-sol" });
        expect(caps).toMatchObject({ defaultEffort: "medium", mode: "openai-effort" });
        expect(caps.supported).toContain("xhigh");
    });
    test("Opus 4.6 maps xhigh through adaptive thinking", async () => {
        const caps = await capabilities(ctx, null, { model: "anthropic-oauth/pro:claude-opus-4-6" });
        expect(caps).toMatchObject({ defaultEffort: "medium", mode: "anthropic-adaptive" });
        expect((await resolve(ctx, null, { model: "anthropic-oauth/pro:claude-opus-4-6", effort: "xhigh" })).applied).toBe("xhigh");
    });
    test("unsupported xhigh safely downgrades without changing preference", async () => {
        const value = await resolve(ctx, null, { model: "anthropic-oauth/pro:claude-sonnet-4-6", effort: "xhigh" });
        expect(value).toMatchObject({ requested: "xhigh", applied: "high", downgraded: true });
    });
    test("non-reasoning models resolve to off", async () => {
        expect(await resolve(ctx, null, { model: "lmstudio:plain", effort: "high" })).toMatchObject({ applied: "off", mode: "none" });
    });
});
