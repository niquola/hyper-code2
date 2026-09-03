type SearchEngine = 'brave' | 'google-browser';

type SearchResult = {
    title: string;
    url: string;
    description: string;
};

/**
 * Searches the public web through the configured engine and returns ranked links in one stable shape.
 *
 * Use this for retrieval-only web discovery. It does not open result pages or ask an LLM to summarize them.
 *
 * @param opts.query Search query sent to the selected engine.
 * @param opts.limit Maximum number of ranked results to return. @default 10 @minimum 1 @maximum 20
 * @param opts.engine Search backend; when omitted, uses the `websearch.defaultEngine` setting. @default google-browser
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Search query sent to the selected engine. */
        query: string;
        /** Maximum number of ranked results to return. @default 10 @minimum 1 @maximum 20 */
        limit?: number;
        /** Search backend; when omitted, uses the `websearch.defaultEngine` setting. @default google-browser */
        engine?: SearchEngine;
    },
): Promise<{ query: string; engine: SearchEngine; results: SearchResult[]; durationMs: number }> {
    const query = String(opts.query ?? '').trim();
    if (!query) throw new Error('websearch.search: query is required');
    const limit = Math.max(1, Math.min(20, Math.trunc(Number(opts.limit ?? 10))));
    const configured = await ctx.fns.settings.getString({
        module: 'websearch',
        scopeType: 'global',
        key: 'defaultEngine',
        fallback: 'google-browser',
    });
    const engine = (opts.engine ?? configured) as SearchEngine;
    if (engine !== 'brave' && engine !== 'google-browser') {
        throw new Error(`websearch.search: unsupported engine ${String(engine)}`);
    }

    const startedAt = performance.now();
    let results: SearchResult[];
    if (engine === 'brave') {
        const response = await ctx.fns.brave.search({ query, count: limit });
        results = response.results.map((item: { title: string; url: string; description: string }) => ({
            title: item.title,
            url: item.url,
            description: item.description,
        }));
    } else {
        const response = await ctx.fns.browser.googleSearch({
            query,
            count: limit,
            session: `websearch-${Date.now()}`,
        });
        results = response.results.map((item: { title: string; url: string; snippet?: string }) => ({
            title: item.title,
            url: item.url,
            description: item.snippet ?? '',
        }));
    }

    return {
        query,
        engine,
        results: results.slice(0, limit),
        durationMs: Math.round(performance.now() - startedAt),
    };
}
