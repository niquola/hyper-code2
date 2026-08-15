/** Retrieves compact runtime-function candidates for the latest real user prompt. */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Agent whose opt-in flag and transcript are inspected. */
        agent: types.agent.Agent;
        /** Transcript used to locate the latest user message. */
        messages: any[];
    },
): Promise<{ messageIdx: number; query: string; functions: Array<{ name: string; summary: string; signature: string; score: number; rank: number; bm25: number | null; similarity: number | null }> } | null> {
    if (opts.agent.functionRagEnabled !== true) return null;
    let messageIdx = -1;
    let query = "";
    for (let i = opts.messages.length - 1; i >= 0; i--) {
        const message = opts.messages[i];
        if (message?.role !== "user" || message?.excluded_from_cursor || message?.message_type && message.message_type !== "message") continue;
        const text = typeof message.content === "string" ? message.content.trim() : "";
        if (!text || text.length < 8) return null;
        messageIdx = Number(message.idx ?? i);
        query = text.slice(0, 2000);
        break;
    }
    if (messageIdx < 0) return null;
    const hits = await ctx.fns.runtime.docs.search({ query, mode: "hybrid", limit: 20 });
    // Branch thresholds are independent: RRF combines rank positions, but is
    // not an absolute relevance score. A candidate may enter through strong
    // lexical evidence OR strong semantic evidence. Cosine 0.32 is calibrated
    // by runtime.docs.ragBenchmark on this localized function corpus/model.
    const functions = hits
        .map((hit: any, index: number) => ({ ...hit, originalRank: index + 1 }))
        .filter((hit: any) => !String(hit.name).startsWith("tmp."))
        .filter((hit: any) => hit.evidence === "exact-name" || hit.evidence === "intersection" || hit.evidence === "bm25-only" || hit.evidence === "vector-only")
        .filter((hit: any) => Number(hit.score) >= 0.015)
        .slice(0, 5)
        .map((hit: any) => ({
            name: hit.name,
            summary: hit.summary,
            signature: compactSignature(hit.signature),
            score: Number(hit.score),
            rank: Number(hit.originalRank),
            bm25: hit.bm25 == null ? null : Number(hit.bm25),
            similarity: hit.similarity == null ? null : Number(hit.similarity),
        }));
    return functions.length ? { messageIdx, query, functions } : null;
}


function compactSignature(signature: string): string {
    return String(signature ?? "").replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim().slice(0, 600);
}
