/**
 * Searches mounted plugins at two levels: plugin workflows from the durable
 * `plugin_docs` index and precise APIs from the shared runtime `functions` index.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Capability intent, preferably concise natural language. */
        query: string;
        /** Maximum plugins returned. @default 5 @minimum 1 @maximum 20 */
        limit?: number;
        /** Maximum matching functions retained per plugin. @default 5 @minimum 1 @maximum 20 */
        functionsPerPlugin?: number;
        /** Retrieval strategy used for both levels. @default "hybrid" */
        mode?: "hybrid" | "bm25" | "vector" | "lexical";
    },
): Promise<Array<{
    plugin: string;
    label: string;
    description: string;
    score: number;
    pluginEvidence?: { score: number; evidence: string };
    functions: Array<{ name: string; summary: string; signature: string; score: number; evidence?: string }>;
}>> {
    const query = String(opts.query ?? "").trim();
    if (!query) throw new Error("plugins.search: query is required");
    const limit = Math.max(1, Math.min(20, Math.floor(opts.limit ?? 5)));
    const perPlugin = Math.max(1, Math.min(20, Math.floor(opts.functionsPerPlugin ?? 5)));
    const mode = opts.mode ?? "hybrid";
    const plugins = (ctx.fns.procs.modules.list({}) as any[]).filter((module: any) => module.plugin);
    const byName = new Map(plugins.map((plugin: any) => [plugin.name, plugin]));
    const owners = new Map<string, any>();
    for (const plugin of plugins) for (const name of [...new Set(plugin.fns as string[])]) owners.set(name, plugin);

    const [pluginMatches, functionMatches] = await Promise.all([
        searchPlugins(ctx, plugins, query, Math.min(50, Math.max(20, limit * 4)), mode),
        ctx.fns.runtime.docs.search({ query, limit: Math.min(50, Math.max(20, plugins.length * perPlugin * 2)), mode }),
    ]);
    const grouped = new Map<string, any>();
    const rowFor = (plugin: any) => {
        const row = grouped.get(plugin.name) ?? { plugin: plugin.name, label: plugin.label, description: plugin.description, score: 0, functions: [] };
        grouped.set(plugin.name, row);
        return row;
    };
    // Reciprocal-rank fusion makes BM25/vector/function score scales comparable.
    const topPluginScore = Math.max(1e-9, ...pluginMatches.map((match: any) => Number(match.score ?? 0)));
    pluginMatches.forEach((match: any, rank: number) => {
        const plugin = byName.get(match.name);
        if (!plugin) return;
        const row = rowFor(plugin);
        row.score += 3 / (20 + rank + 1) + 0.5 * (Number(match.score ?? 0) / topPluginScore);
        row.pluginEvidence = { score: Number(match.score ?? 0), evidence: match.evidence ?? "plugin" };
    });
    const functionBoost = new Map<string, number>();
    functionMatches.forEach((match: any, rank: number) => {
        const plugin = owners.get(match.name);
        if (!plugin) return;
        const row = rowFor(plugin);
        functionBoost.set(plugin.name, Math.max(functionBoost.get(plugin.name) ?? 0, 1 / (20 + rank + 1)));
        if (row.functions.length < perPlugin) row.functions.push({ name: match.name, summary: match.summary, signature: match.signature, score: Number(match.score ?? 0), evidence: match.evidence });
    });
    for (const [name, boost] of functionBoost) grouped.get(name).score += boost;
    return [...grouped.values()].sort((a, b) => b.score - a.score || a.plugin.localeCompare(b.plugin)).slice(0, limit);
}

async function searchPlugins(ctx: Context, plugins: any[], query: string, limit: number, mode: string): Promise<any[]> {
    if (mode === "lexical") return lexicalPlugins(plugins, query, limit);
    try {
        const count = Number((await ctx.fns.procs.db.select({ sql: "SELECT count(*)::int n FROM plugin_docs", params: [] }) as any[])[0]?.n ?? 0);
        if (!count) await ctx.fns.plugins.index({});
        const keyword = await ctx.fns.procs.db.select({
            sql: `SELECT name, paradedb.score(name) score FROM plugin_docs WHERE search_text @@@ paradedb.match('search_text', ?) ORDER BY score DESC, name LIMIT ${limit}`,
            params: [query],
        });
        if (mode === "bm25") return keyword.map((row: any) => ({ ...row, score: Number(row.score), evidence: "plugin-bm25" }));
        const provider = await ctx.fns.embeddings.provider({});
        if (provider === "off") return keyword.map((row: any) => ({ ...row, score: Number(row.score), evidence: "plugin-bm25" }));
        let vector: number[] | undefined;
        try { vector = (await ctx.fns.embeddings.embed({ input: query })).vectors[0]; }
        catch { return keyword.map((row: any) => ({ ...row, score: Number(row.score), evidence: "plugin-bm25" })); }
        if (!vector) return keyword.map((row: any) => ({ ...row, score: Number(row.score), evidence: "plugin-bm25" }));
        const semantic = await ctx.fns.procs.db.select({ sql: `SELECT name,1-(embedding <=> ?::public.halfvec) similarity FROM plugin_docs WHERE embedding IS NOT NULL ORDER BY embedding <=> ?::public.halfvec LIMIT ${limit}`, params: [JSON.stringify(vector), JSON.stringify(vector)] });
        if (mode === "vector") return semantic.map((row: any) => ({ ...row, score: Number(row.similarity), evidence: "plugin-vector" }));
        const ranks = new Map<string, any>();
        keyword.forEach((row: any, rank: number) => ranks.set(row.name, { name: row.name, score: 1 / (60 + rank + 1), evidence: "plugin-bm25" }));
        semantic.forEach((row: any, rank: number) => {
            const hit = ranks.get(row.name) ?? { name: row.name, score: 0, evidence: "plugin-vector" };
            hit.score += 1 / (60 + rank + 1);
            if (ranks.has(row.name)) hit.evidence = "plugin-hybrid";
            ranks.set(row.name, hit);
        });
        return [...ranks.values()].sort((a, b) => b.score - a.score).slice(0, limit);
    } catch {
        return lexicalPlugins(plugins, query, limit);
    }
}

function lexicalPlugins(plugins: any[], query: string, limit: number): any[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return plugins.map(plugin => {
        const text = `${plugin.name} ${plugin.label ?? ""} ${plugin.description ?? ""}`.toLowerCase();
        const score = words.reduce((sum, word) => sum + (plugin.name.toLowerCase().includes(word) ? 8 : text.includes(word) ? 2 : 0), 0);
        return { name: plugin.name, score, evidence: "plugin-lexical" };
    }).filter(hit => hit.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}
