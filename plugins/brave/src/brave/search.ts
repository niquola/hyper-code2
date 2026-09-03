type BraveWebResult = {
    title?: string;
    url?: string;
    description?: string;
    age?: string;
    page_age?: string;
    language?: string;
    family_friendly?: boolean;
    profile?: { long_name?: string };
    extra_snippets?: string[];
};

type BraveResponse = {
    type?: string;
    query?: { original?: string; altered?: string; spellcheck_off?: boolean; show_strict_warning?: boolean };
    web?: { type?: string; results?: BraveWebResult[]; family_friendly?: boolean };
    mixed?: unknown;
    news?: unknown;
    videos?: unknown;
    infobox?: unknown;
    locations?: unknown;
    discussions?: unknown;
};

type SearchResult = {
    title: string;
    url: string;
    description: string;
    age: string | null;
    pageAge: string | null;
    language: string | null;
    familyFriendly: boolean | null;
    profile: string | null;
    extraSnippets: string[];
};

/**
 * Low-level search of Brave's web index with provider-specific filters and the unmodified API response.
 *
 * Prefer websearch.search for ordinary web discovery. Use this function when Brave-specific filters, pagination, extra snippets, or the raw provider response are required.
 *
 * @param opts.query Search query sent to Brave Web Search.
 * @param opts.count Maximum number of results requested from Brave. @default 10 @minimum 1 @maximum 20
 * @param opts.country Two-letter country code used to localize ranking, such as `US` or `PT`.
 * @param opts.searchLang ISO language code for result content, such as `en` or `ru`.
 * @param opts.uiLang Locale for Brave-provided UI strings, such as `en-US`.
 * @param opts.freshness Recency filter: `pd`, `pw`, `pm`, `py`, or a Brave custom date range.
 * @param opts.safeSearch Adult-content filtering level. @default moderate
 * @param opts.offset Zero-based result-page offset supported by Brave. @default 0 @minimum 0 @maximum 9
 * @param opts.extraSnippets Ask Brave to include additional matching snippets. @default false
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Search query sent to Brave Web Search. */
        query: string;
        /** Maximum number of results requested from Brave. @default 10 @minimum 1 @maximum 20 */
        count?: number;
        /** Two-letter country code used to localize ranking, such as `US` or `PT`. */
        country?: string;
        /** ISO language code for result content, such as `en` or `ru`. */
        searchLang?: string;
        /** Locale for Brave-provided UI strings, such as `en-US`. */
        uiLang?: string;
        /** Recency filter: `pd`, `pw`, `pm`, `py`, or a Brave custom date range. */
        freshness?: string;
        /** Adult-content filtering level. @default moderate */
        safeSearch?: 'off' | 'moderate' | 'strict';
        /** Zero-based result-page offset supported by Brave. @default 0 @minimum 0 @maximum 9 */
        offset?: number;
        /** Ask Brave to include additional matching snippets. @default false */
        extraSnippets?: boolean;
    },
): Promise<{ query: string; results: SearchResult[]; raw: BraveResponse }> {
    const query = String(opts.query ?? '').trim();
    if (!query) throw new Error('brave.search: query is required');

    const cache = ((ctx.state as any).brave ??= {} as { apiKey?: string });
    const apiKey = cache.apiKey
        ?? ctx.env.BRAVE_SEARCH_API_KEY
        ?? await ctx.fns.secrets.getLocal({ namespace: 'brave', name: 'apiKey' })
        ?? await ctx.fns.secrets.get({ ref: 'op://hyper/brave api_key.txt/credential', namespace: 'brave', name: 'apiKey' });
    if (!apiKey) throw new Error('brave.search: BRAVE_SEARCH_API_KEY is not configured');
    cache.apiKey = apiKey;

    const count = Math.max(1, Math.min(20, Math.trunc(Number(opts.count ?? 10))));
    const offset = Math.max(0, Math.min(9, Math.trunc(Number(opts.offset ?? 0))));
    const params = new URLSearchParams({
        q: query,
        count: String(count),
        offset: String(offset),
        safesearch: opts.safeSearch ?? 'moderate',
    });
    if (opts.country) params.set('country', String(opts.country).toLowerCase());
    if (opts.searchLang) params.set('search_lang', String(opts.searchLang).toLowerCase());
    if (opts.uiLang) params.set('ui_lang', String(opts.uiLang));
    if (opts.freshness) params.set('freshness', String(opts.freshness));
    if (opts.extraSnippets) params.set('extra_snippets', 'true');

    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': apiKey,
        },
        signal: AbortSignal.timeout(15_000),
    });
    const body = await response.text();
    if (!response.ok) {
        const compact = body.replace(/\s+/g, ' ').slice(0, 500);
        throw new Error(`brave.search: Brave API returned ${response.status} ${response.statusText}${compact ? `: ${compact}` : ''}`);
    }

    let raw: BraveResponse;
    try {
        raw = JSON.parse(body) as BraveResponse;
    } catch {
        throw new Error('brave.search: Brave API returned invalid JSON');
    }

    const seen = new Set<string>();
    const results: SearchResult[] = [];
    for (const item of raw.web?.results ?? []) {
        const url = String(item.url ?? '').trim();
        const title = String(item.title ?? '').trim();
        if (!url || !title || seen.has(url)) continue;
        seen.add(url);
        results.push({
            title,
            url,
            description: String(item.description ?? ''),
            age: item.age ?? null,
            pageAge: item.page_age ?? null,
            language: item.language ?? null,
            familyFriendly: typeof item.family_friendly === 'boolean' ? item.family_friendly : null,
            profile: item.profile?.long_name ?? null,
            extraSnippets: Array.isArray(item.extra_snippets) ? item.extra_snippets.map(String) : [],
        });
    }

    return { query, results, raw };
}
