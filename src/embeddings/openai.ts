/** Embeds text through OpenAI's embeddings API. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Text or texts to embed. */
        input: string | string[];
        /** OpenAI embeddings model override. */
        model?: string;
    },
): Promise<{ provider: "openai"; model: string; dimensions: number; vectors: number[][] }> {
    const apiKey = await ctx.fns.secrets.resolveSetting({ module: "llm", scopeType: "global", key: "openaiApiKey" });
    if (!apiKey) throw new Error("OpenAI embeddings require llm.openaiApiKey or OPENAI_API_KEY");
    const model = opts.model || await ctx.fns.settings.getString({
        module: "embeddings", scopeType: "global", key: "model", fallback: "text-embedding-3-small",
    }) || "text-embedding-3-small";
    const inputs = (Array.isArray(opts.input) ? opts.input : [opts.input]).map(text => String(text || " ").slice(0, 30_000));
    if (!inputs.length) return { provider: "openai", model, dimensions: 0, vectors: [] };
    const vectors: number[][] = [];
    for (let offset = 0; offset < inputs.length; offset += 128) {
        const res = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
            body: JSON.stringify({ model, input: inputs.slice(offset, offset + 128), dimensions: 1536 }),
        });
        const text = await res.text();
        let json: any;
        try { json = JSON.parse(text); } catch { throw new Error(`OpenAI embeddings ${res.status}: ${text.slice(0, 300)}`); }
        if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${JSON.stringify(json?.error ?? json).slice(0, 400)}`);
        for (const row of json.data ?? []) vectors[offset + Number(row.index)] = row.embedding;
    }
    return { provider: "openai", model, dimensions: vectors[0]?.length ?? 0, vectors };
}
