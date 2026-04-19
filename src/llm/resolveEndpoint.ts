// Parse agent.model "provider:modelId" → {url, apiKey, modelId, provider, api}.
// "modelId" without prefix defaults to provider "lmstudio".
export default function (ctx: Context, model: string): {
    url: string;
    apiKey: string | null;
    modelId: string;
    provider: string;
    api: "openai" | "anthropic";
} {
    const m = /^([a-z][\w\-]*):(.+)$/.exec(model);
    const provider = m ? m[1]! : "lmstudio";
    const modelId = m ? m[2]! : model;
    const p = PROVIDERS[provider];
    if (!p) throw new Error(`unknown provider: ${provider}`);
    const baseUrl = p.resolveBaseUrl(ctx);
    const apiKey = p.resolveApiKey ? p.resolveApiKey(ctx) : null;
    const url = p.api === "anthropic" ? `${baseUrl}/v1/messages` : `${baseUrl}/chat/completions`;
    return { url, apiKey, modelId, provider, api: p.api };
}

type ProviderConfig = {
    api: "openai" | "anthropic";
    resolveBaseUrl: (ctx: Context) => string;
    resolveApiKey?: (ctx: Context) => string | null;
};

const envKey = (name: string) => (ctx: Context) => ctx.env[name] ?? null;

const PROVIDERS: Record<string, ProviderConfig> = {
    lmstudio: {
        api: "openai",
        resolveBaseUrl: (ctx) => (ctx.env.LMSTUDIO_URL ?? "http://localhost:1234") + "/v1",
    },
    kimi: {
        // Moonshot-AI OpenAI-compat (NOT the kimi.com/coding subscription — use kimi-coding: for that)
        api: "openai",
        resolveBaseUrl: () => "https://api.moonshot.ai/v1",
        resolveApiKey: envKey("KIMI_API_KEY"),
    },
    "kimi-coding": {
        // Kimi coding subscription — Anthropic-messages protocol
        api: "anthropic",
        resolveBaseUrl: () => "https://api.kimi.com/coding",
        resolveApiKey: (ctx) => {
            if (ctx.env.KIMI_CODING_API_KEY) return ctx.env.KIMI_CODING_API_KEY;
            try {
                const { readFileSync } = require("node:fs");
                const home = ctx.env.HOME ?? process.env.HOME ?? "";
                const raw = readFileSync(`${home}/.kimi/credentials/kimi-code.json`, "utf8");
                return JSON.parse(raw).access_token ?? null;
            } catch { return null; }
        },
    },
    anthropic: {
        api: "anthropic",
        resolveBaseUrl: () => "https://api.anthropic.com",
        resolveApiKey: envKey("ANTHROPIC_API_KEY"),
    },
    openai: {
        api: "openai",
        resolveBaseUrl: () => "https://api.openai.com/v1",
        resolveApiKey: envKey("OPENAI_API_KEY"),
    },
    groq: {
        api: "openai",
        resolveBaseUrl: () => "https://api.groq.com/openai/v1",
        resolveApiKey: envKey("GROQ_API_KEY"),
    },
    openrouter: {
        api: "openai",
        resolveBaseUrl: () => "https://openrouter.ai/api/v1",
        resolveApiKey: envKey("OPENROUTER_API_KEY"),
    },
};
