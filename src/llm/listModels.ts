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

    return out;
}
