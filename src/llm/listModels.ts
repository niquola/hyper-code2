// Return models grouped by provider-prefix.
// LM Studio is queried live; remote providers return a small curated static list.
// Missing/unreachable providers are omitted silently.
export default async function (ctx: Context): Promise<Record<string, string[]>> {
    const out: Record<string, string[]> = {};

    // Local: LM Studio /v1/models
    const lmUrl = (ctx.env.LMSTUDIO_URL ?? "http://localhost:1234") + "/v1/models";
    try {
        const res = await fetch(lmUrl, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
            const body: any = await res.json();
            const ids = (body.data ?? []).map((m: any) => m.id).filter(Boolean);
            if (ids.length) out.lmstudio = ids;
        }
    } catch { /* unreachable — skip */ }

    // Remote curated defaults (prefixed with provider: so you copy-paste the model string directly)
    out.kimi = [
        "kimi:kimi-k2-turbo-preview",
        "kimi:moonshot-v1-32k",
        "kimi:moonshot-v1-128k",
    ];
    out.openai = [
        "openai:gpt-5-codex",
        "openai:gpt-5.1-mini",
        "openai:gpt-4o-mini",
    ];
    out.groq = [
        "groq:llama-3.3-70b-versatile",
        "groq:moonshotai/kimi-k2-instruct",
    ];
    out.openrouter = [
        "openrouter:anthropic/claude-sonnet-4.6",
        "openrouter:google/gemini-2.5-pro",
    ];

    // Codex (ChatGPT subscription) — only if user has a valid JWT.
    // Models pulled live from /codex/models (subscription-gated whitelist).
    try {
        const tok = await ctx.fns.llm.refreshCodex?.(ctx);
        if (tok) {
            const url = "https://chatgpt.com/backend-api/codex/models?client_version=0.120.0";
            const r = await fetch(url, {
                headers: { "authorization": `Bearer ${tok}`, "originator": "hyper-code2" },
                signal: AbortSignal.timeout(3000),
            });
            if (r.ok) {
                const j: any = await r.json();
                const ids = (j.models ?? [])
                    .filter((m: any) => m.visibility !== "hidden" && m.supported_in_api !== false)
                    .map((m: any) => `codex:${m.slug}`);
                if (ids.length) out.codex = ids;
            }
        }
    } catch { /* not logged in or unreachable — omit */ }

    // Claude Code (Anthropic subscription) — only if user has a valid token in
    // the macOS keychain. Anthropic actively rejects sonnet/opus for non-CLI
    // OAuth clients with 429 (per-model anti-fraud), so we only expose haiku
    // here. For sonnet/opus use the `anthropic:` provider with an API key.
    try {
        const tok = await ctx.fns.llm.refreshClaudeCode?.(ctx);
        if (tok) {
            out["claude-code"] = [
                "claude-code:claude-haiku-4-5-20251001",
            ];
        }
    } catch { /* no keychain access — omit */ }

    return out;
}
