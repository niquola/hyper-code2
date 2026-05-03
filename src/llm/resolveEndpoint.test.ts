import { test, expect, describe } from "bun:test";
import resolve from "./resolveEndpoint";
import getString from "../settings/getString";
import get from "../settings/get";

// Declarations from src/llm/$setting_*.ts. Tests don't go through loadFns,
// so we seed ctx.state.settingsRegistry by hand. Keep in sync with the files.
function makeRegistry() {
    return new Map<string, any>([
        ['llm.lmstudioBaseUrl', { type: 'string', env: 'LMSTUDIO_URL', default: 'http://localhost:1234' }],
        ['llm.openaiApiKey',    { type: 'secret', env: 'OPENAI_API_KEY', default: null }],
        ['llm.kimiApiKey',      { type: 'secret', env: 'KIMI_API_KEY',   default: null }],
        ['llm.groqApiKey',      { type: 'secret', env: 'GROQ_API_KEY',   default: null }],
        ['llm.anthropicApiKey', { type: 'secret', env: 'ANTHROPIC_API_KEY', default: null }],
        ['llm.openrouterApiKey',{ type: 'secret', env: 'OPENROUTER_API_KEY', default: null }],
    ]);
}

const mkCtx = (env: Record<string, string> = {}) => ({
    env,
    state: { db: null, settingsRegistry: makeRegistry() },
    fns: {
        db: { select: () => [] },          // no DB rows in unit-test
        settings: { getString, get },
    },
} as unknown as Context);

describe("ai.resolveEndpoint", () => {
    test("no prefix → lmstudio default", () => {
        const r = resolve(mkCtx(), { model: "minimax/minimax-m2.7" });
        expect(r.provider).toBe("lmstudio");
        expect(r.modelId).toBe("minimax/minimax-m2.7");
        expect(r.url).toBe("http://localhost:1234/v1/chat/completions");
        expect(r.apiKey).toBeNull();
    });

    test("LMSTUDIO_URL env override", () => {
        const r = resolve(mkCtx({ LMSTUDIO_URL: "http://other:5000" }), { model: "foo" });
        expect(r.url).toBe("http://other:5000/v1/chat/completions");
    });

    test("kimi: prefix → moonshot endpoint + KIMI_API_KEY", () => {
        const r = resolve(mkCtx({ KIMI_API_KEY: "sk-kimi" }), { model: "kimi:kimi-k2-turbo-preview" });
        expect(r.provider).toBe("kimi");
        expect(r.modelId).toBe("kimi-k2-turbo-preview");
        expect(r.url).toBe("https://api.moonshot.ai/v1/chat/completions");
        expect(r.apiKey).toBe("sk-kimi");
    });

    test("openai: prefix", () => {
        const r = resolve(mkCtx({ OPENAI_API_KEY: "sk-oai" }), { model: "openai:gpt-4o-mini" });
        expect(r.modelId).toBe("gpt-4o-mini");
        expect(r.url).toBe("https://api.openai.com/v1/chat/completions");
        expect(r.apiKey).toBe("sk-oai");
    });

    test("unknown provider throws", () => {
        expect(() => resolve(mkCtx(), { model: "zzz:model" })).toThrow(/unknown provider/);
    });

    test("modelId with colon preserved", () => {
        const r = resolve(mkCtx(), { model: "kimi:some/model:with:colons" });
        expect(r.modelId).toBe("some/model:with:colons");
    });

    test("claude-code: prefix → anthropic /v1/messages, apiKey null (refreshed lazily)", () => {
        const r = resolve(mkCtx(), { model: "claude-code:claude-opus-4-7" });
        expect(r.provider).toBe("claude-code");
        expect(r.api).toBe("anthropic");
        expect(r.modelId).toBe("claude-opus-4-7");
        expect(r.url).toBe("https://api.anthropic.com/v1/messages");
        expect(r.apiKey).toBeNull();
    });
});
