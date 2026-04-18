// Parse an agent.model string and return the HTTP endpoint + auth + actual modelId.
//
// Formats:
//   "provider:modelId"  → look up provider config (baseUrl + apiKey env var)
//   "modelId"           → default provider = "lmstudio"
//
// Providers are OpenAI-compatible (chat/completions with tool calls + streaming).
// Anthropic-native and Codex-native protocols live in separate stream fns — not here.
export default function (ctx: Context, model: string): { url: string; apiKey: string | null; modelId: string; provider: string } {
    const m = /^([a-z][\w\-]*):(.+)$/.exec(model);
    const provider = m ? m[1]! : "lmstudio";
    const modelId = m ? m[2]! : model;

    const p = PROVIDERS[provider];
    if (!p) throw new Error(`unknown provider: ${provider}`);
    const baseUrl = p.resolveBaseUrl(ctx);
    const apiKey = p.apiKeyEnv ? (ctx.env[p.apiKeyEnv] ?? null) : null;
    return { url: `${baseUrl}/chat/completions`, apiKey, modelId, provider };
}

type ProviderConfig = {
    resolveBaseUrl: (ctx: Context) => string;
    apiKeyEnv?: string;
};

const PROVIDERS: Record<string, ProviderConfig> = {
    lmstudio: {
        resolveBaseUrl: (ctx) => (ctx.env.LMSTUDIO_URL ?? "http://localhost:1234") + "/v1",
    },
    kimi: {
        // Moonshot (Kimi) OpenAI-compatible endpoint
        resolveBaseUrl: () => "https://api.moonshot.ai/v1",
        apiKeyEnv: "KIMI_API_KEY",
    },
    openai: {
        resolveBaseUrl: () => "https://api.openai.com/v1",
        apiKeyEnv: "OPENAI_API_KEY",
    },
    groq: {
        resolveBaseUrl: () => "https://api.groq.com/openai/v1",
        apiKeyEnv: "GROQ_API_KEY",
    },
    openrouter: {
        resolveBaseUrl: () => "https://openrouter.ai/api/v1",
        apiKeyEnv: "OPENROUTER_API_KEY",
    },
};
