// Parse agent.model "provider:modelId" → {url, apiKey, modelId, provider, api}.
// "modelId" without prefix defaults to provider "lmstudio".
export default function (ctx: Context, opts: { model: string }): {
    url: string;
    apiKey: string | null;
    modelId: string;
    provider: string;
    api: "openai" | "anthropic" | "responses" | "mock";
} {
    const model = opts.model;
    const m = /^([a-z][\w\-]*):(.+)$/.exec(model);
    const provider = m ? m[1]! : "lmstudio";
    const modelId = m ? m[2]! : model;
    const p = PROVIDERS[provider];
    if (!p) throw new Error(`unknown provider: ${provider}`);

    // baseUrl + apiKey come from the provider's resolveBaseUrl/resolveApiKey,
    // which themselves consult declared settings (src/llm/$setting_*.ts).
    const baseUrl = p.resolveBaseUrl(ctx);
    const apiKey = p.resolveApiKey ? p.resolveApiKey(ctx) : null;
    const url = p.api === "anthropic" ? `${baseUrl}/v1/messages`
        : p.api === "responses" ? `${baseUrl}/responses`
            : `${baseUrl}/chat/completions`;
    return { url, apiKey, modelId, provider, api: p.api };
}

type ProviderConfig = {
    api: "openai" | "anthropic" | "responses" | "mock";
    resolveBaseUrl: (ctx: Context) => string;
    resolveApiKey?: (ctx: Context) => string | null;
};

// Read a string-typed declared setting (module=llm, scope=global). Returns undefined
// when no declaration / no DB row / no env var / no default.
const declaredString = (key: string) => (ctx: Context): string | null => {
    const v = ctx.fns?.settings?.getString?.(ctx, { module: 'llm', scopeType: 'global', key });
    return (typeof v === 'string' && v) ? v : null;
};

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
        // src/llm/$setting_lmstudioBaseUrl.ts handles env LMSTUDIO_URL → default.
        resolveBaseUrl: (ctx) => (declaredString('lmstudioBaseUrl')(ctx) ?? 'http://localhost:1234') + '/v1',
    },
    kimi: {
        // Moonshot-AI OpenAI-compat (NOT the kimi.com/coding subscription — use kimi-coding: for that)
        api: "openai",
        resolveBaseUrl: () => "https://api.moonshot.ai/v1",
        resolveApiKey: declaredString('kimiApiKey'),
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
        resolveApiKey: declaredString('anthropicApiKey'),
    },
    "claude-code": {
        // Anthropic subscription via the Claude Code CLI's keychain entry.
        // Token is fetched/refreshed in streamAnthropic at request time (mirrors
        // kimi-coding flow). resolveApiKey returns null here so callers know
        // the apiKey populates lazily — streamAnthropic dispatches by provider.
        api: "anthropic",
        resolveBaseUrl: () => "https://api.anthropic.com",
        resolveApiKey: () => null,
    },
    openai: {
        api: "openai",
        resolveBaseUrl: () => "https://api.openai.com/v1",
        resolveApiKey: declaredString('openaiApiKey'),
    },
    groq: {
        api: "openai",
        resolveBaseUrl: () => "https://api.groq.com/openai/v1",
        resolveApiKey: declaredString('groqApiKey'),
    },
    openrouter: {
        api: "openai",
        resolveBaseUrl: () => "https://openrouter.ai/api/v1",
        resolveApiKey: declaredString('openrouterApiKey'),
    },
    mock: {
        api: "mock",
        resolveBaseUrl: () => "mock://local",
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
