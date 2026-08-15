import { afterEach, expect, test } from "bun:test";
import { testCtx } from "../$test";

const ctx = await testCtx();
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test("OpenAI embedding provider batches text and returns ordered vectors", async () => {
    await ctx.fns.settings.set({ module: "llm", scopeType: "global", key: "openaiApiKey", value: "test-key", isSecret: true });
    await ctx.fns.settings.set({ module: "embeddings", scopeType: "global", key: "provider", value: "openai" });
    globalThis.fetch = (async (_url: any, init: any) => {
        expect(init.headers.authorization).toBe("Bearer test-key");
        const body = JSON.parse(init.body);
        expect(body).toMatchObject({ model: "text-embedding-3-small", input: ["one", "two"], dimensions: 1536 });
        return Response.json({ data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }] });
    }) as any;
    const result = await ctx.fns.embeddings.embed({ input: ["one", "two"] });
    expect(result).toMatchObject({ provider: "openai", model: "text-embedding-3-small", dimensions: 2, vectors: [[1, 0], [0, 1]] });
});

test("disabled embeddings fail explicitly", async () => {
    await ctx.fns.settings.set({ module: "embeddings", scopeType: "global", key: "provider", value: "off" });
    await expect(ctx.fns.embeddings.embed({ input: "hello" })).rejects.toThrow("disabled");
});
