import { test, expect, describe } from "bun:test";
import resolve from "./resolveEndpoint";

const mkCtx = (env: Record<string, string> = {}) => ({ env } as unknown as Context);

describe("ai.resolveEndpoint", () => {
    test("no prefix → lmstudio default", () => {
        const r = resolve(mkCtx(), "minimax/minimax-m2.7");
        expect(r.provider).toBe("lmstudio");
        expect(r.modelId).toBe("minimax/minimax-m2.7");
        expect(r.url).toBe("http://localhost:1234/v1/chat/completions");
        expect(r.apiKey).toBeNull();
    });

    test("LMSTUDIO_URL env override", () => {
        const r = resolve(mkCtx({ LMSTUDIO_URL: "http://other:5000" }), "foo");
        expect(r.url).toBe("http://other:5000/v1/chat/completions");
    });

    test("kimi: prefix → moonshot endpoint + KIMI_API_KEY", () => {
        const r = resolve(mkCtx({ KIMI_API_KEY: "sk-kimi" }), "kimi:kimi-k2-turbo-preview");
        expect(r.provider).toBe("kimi");
        expect(r.modelId).toBe("kimi-k2-turbo-preview");
        expect(r.url).toBe("https://api.moonshot.ai/v1/chat/completions");
        expect(r.apiKey).toBe("sk-kimi");
    });

    test("openai: prefix", () => {
        const r = resolve(mkCtx({ OPENAI_API_KEY: "sk-oai" }), "openai:gpt-4o-mini");
        expect(r.modelId).toBe("gpt-4o-mini");
        expect(r.url).toBe("https://api.openai.com/v1/chat/completions");
        expect(r.apiKey).toBe("sk-oai");
    });

    test("unknown provider throws", () => {
        expect(() => resolve(mkCtx(), "zzz:model")).toThrow(/unknown provider/);
    });

    test("modelId with colon preserved", () => {
        const r = resolve(mkCtx(), "kimi:some/model:with:colons");
        expect(r.modelId).toBe("some/model:with:colons");
    });
});
