/** Generates cached-search locale text for function documentation via OpenAI. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Function records with stable names and canonical English retrieval text. */
        functions: Array<{ name: string; text: string }>;
        /** BCP-47-like target locale codes. */
        locales: string[];
        /** Optional OpenAI chat model override. */
        model?: string;
    },
): Promise<{ provider: "openai"; model: string; localized: Record<string, string> }> {
    if (!opts.functions.length || !opts.locales.length) return { provider: "openai", model: opts.model ?? "gpt-4.1-mini", localized: {} };
    const apiKey = await ctx.fns.secrets.resolveSetting({ module: "llm", scopeType: "global", key: "openaiApiKey" });
    if (!apiKey) throw new Error("retrieval localization requires llm.openaiApiKey or OPENAI_API_KEY");
    const model = opts.model || await ctx.fns.settings.getString({ module: "embeddings", scopeType: "global", key: "localizationModel", fallback: "gpt-4.1-mini" }) || "gpt-4.1-mini";
    const localized: Record<string, string> = {};
    // One function per structured response avoids omissions. Five concurrent
    // requests keep an index batch observable without serial minute-long stalls.
    for (let offset = 0; offset < opts.functions.length; offset += 5) {
        const group = opts.functions.slice(offset, offset + 5);
        const rows = await Promise.all(group.map(fn => localizeOne(apiKey, model, opts.locales, fn)));
        for (const row of rows) localized[row.name] = row.text;
    }
    return { provider: "openai", model, localized };
}

async function localizeOne(apiKey: string, model: string, locales: string[], fn: { name: string; text: string }): Promise<{ name: string; text: string }> {
    const schema = {
        type: "object", additionalProperties: false, required: ["name", "text"],
        properties: { name: { type: "string" }, text: { type: "string" } },
    };
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
            model, temperature: 0,
            response_format: { type: "json_schema", json_schema: { name: "localized_function_search", strict: true, schema } },
            messages: [
                { role: "system", content: "Create multilingual retrieval text for one runtime function. Preserve the exact function name. In text, write for every requested locale: a precise capability description, synonyms, and 8 natural user requests this exact function can satisfy. Include specific requests with parameters and broad intent requests when this function is the correct first operation. For list/read functions include checking the resource and seeing what is new. Include colloquial requests and grammatical forms useful for lexical search. Describe only the exact source capability; never invent adjacent behavior. text must be plain text. No markdown or commentary." },
                { role: "user", content: JSON.stringify({ locales, function: { name: fn.name, source: fn.text.slice(0, 6000) } }) },
            ],
        }),
    });
    const raw = await response.text();
    let json: any;
    try { json = JSON.parse(raw); } catch { throw new Error(`OpenAI localization ${response.status}: invalid JSON`); }
    if (!response.ok) throw new Error(`OpenAI localization ${response.status}: ${JSON.stringify(json?.error ?? json).slice(0, 400)}`);
    let body: any;
    try { body = JSON.parse(json?.choices?.[0]?.message?.content ?? "{}"); } catch { throw new Error(`OpenAI localization returned invalid content for ${fn.name}`); }
    const name = String(body?.name ?? "");
    const text = String(body?.text ?? "").trim();
    if (name !== fn.name || text.length < 120 || text === "[object Object]") throw new Error(`OpenAI localization invalid for ${fn.name}`);
    return { name, text: text.slice(0, 8000) };
}
