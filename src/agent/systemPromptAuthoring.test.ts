import { expect, test } from "bun:test";
import { testCtx } from "../$test";

const ctx = await testCtx();

test("every newly assembled agent prompt includes runtime authoring rules", async () => {
    const prompt = await ctx.fns.agent.fullSystemPrompt({ agent: { id: "new", model: "mock:test", systemPrompt: "", messages: [], events: [], scratchpad: {} } as any });
    expect(prompt).toContain("ctx.fns.procs.dev.createFunction");
    expect(prompt).toContain("ctx.fns.runtime.docs.validate");
    expect(prompt).toContain("strict: true, typecheck: true");
    expect(prompt).toContain("Do not hand-write localized keyword lists");
});
