// Parse agent.model "provider:modelId" → {url, apiKey, modelId, provider, api}.
// "modelId" without prefix defaults to provider "lmstudio".
export default function (ctx: Context, model: string): {
    url: string;
    apiKey: string | null;
    modelId: string;
    provider: string;
    api: "openai" | "anthropic" | "responses";
} {
    const m = /^([a-z][\w\-]*):(.+)$/.exec(model);
    const provider = m ? m[1]! : "lmstudio";
    const modelId = m ? m[2]! : model;
    const p = PROVIDERS[provider];
    if (!p) throw new Error(`unknown provider: ${provider}`);
    const baseUrl = p.resolveBaseUrl(ctx);
    const apiKey = p.resolveApiKey ? p.resolveApiKey(ctx) : null;
    const url = p.api === "anthropic" ? `${baseUrl}/v1/messages`
        : p.api === "responses" ? `${baseUrl}/responses`
            : `${baseUrl}/chat/completions`;
    return { url, apiKey, modelId, provider, api: p.api };
}

type ProviderConfig = {
    api: "openai" | "anthropic" | "responses";
    resolveBaseUrl: (ctx: Context) => string;
    resolveApiKey?: (ctx: Context) => string | null;
};

const envKey = (name: string) => (ctx: Context) => ctx.env[name] ?? null;

function decodeJwtExp(token: string): number | null {
    try {
        const payload = token.split(".")[1];
        if (!payload) return null;
        const json = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
        return typeof json.exp === "number" ? json.exp : null;
    } catch { return null; }
}

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
        // Kimi coding subscription — Anthropic-messages protocol.
        // Token is read fresh from ~/.kimi/credentials/kimi-code.json on every
        // call (no caching). JWT exp is checked; expired tokens return null so
        // the caller fails loud instead of silently using a stale token.
        api: "anthropic",
        resolveBaseUrl: () => "https://api.kimi.com/coding",
        resolveApiKey: (ctx) => {
            if (ctx.env.KIMI_CODING_API_KEY) return ctx.env.KIMI_CODING_API_KEY;
            try {
                const { readFileSync } = require("node:fs");
                const home = ctx.env.HOME ?? process.env.HOME ?? "";
                const raw = readFileSync(`${home}/.kimi/credentials/kimi-code.json`, "utf8");
                const j = JSON.parse(raw);
                const tok = j.access_token;
                if (!tok) return null;
                const exp = decodeJwtExp(tok);
                const now = Math.floor(Date.now() / 1000);
                if (exp && exp < now - 5) {
                    console.warn(`[kimi-coding] token expired ${now - exp}s ago — run \`kimi login\` to refresh`);
                    return null;
                }
                return tok;
            } catch (e: any) {
                console.warn(`[kimi-coding] cannot read credentials: ${e?.message}`);
                return null;
            }
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
    codex: {
        // OpenAI ChatGPT subscription via Codex backend (Responses API).
        // Uses ~/.codex/auth.json (same file `codex` CLI maintains).
        // streamCodex() always re-asks refreshCodex() right before sending,
        // so an expired access_token here is fine — it gets refreshed there.
        api: "responses",
        resolveBaseUrl: () => "https://chatgpt.com/backend-api/codex",
        resolveApiKey: (ctx) => {
            try {
                const { readFileSync } = require("node:fs");
                const home = ctx.env.HOME ?? process.env.HOME ?? "";
                const raw = readFileSync(`${home}/.codex/auth.json`, "utf8");
                return JSON.parse(raw)?.tokens?.access_token ?? null;
            } catch { return null; }
        },
    },
};
