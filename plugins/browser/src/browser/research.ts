// Search Google, then read several result pages concurrently in independent
// background tabs. Returns evidence, not a synthesized answer — the calling
// agent compares sources and draws conclusions itself.
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: { query: string; pages?: number; maxCharsPerPage?: number; session?: string; keepOpen?: boolean },
) {
    const pages = Math.max(1, Math.min(Number(opts.pages ?? 4), 8));
    const base = opts.session || "research";
    try {
        const search = await ctx.fns.browser.googleSearch({ query: opts.query, count: Math.max(pages, 6), session: `${base}-search`, keepOpen: true });
    const selected = search.results.slice(0, pages);
    const documents = await Promise.all(selected.map(async (result: any, index: number) => {
        try {
            const page = await ctx.fns.browser.readPage({
                url: result.url,
                session: `${base}-page-${index + 1}`,
                maxChars: opts.maxCharsPerPage ?? 10_000,
            });
            return { ...result, ...page, error: null };
        } catch (error: any) {
            return { ...result, text: "", truncated: false, error: String(error?.message ?? error) };
        }
    }));
        return { query: opts.query, searchUrl: search.url, documents };
    } finally {
        if (!opts.keepOpen) await ctx.fns.browser.closeSessions({ prefix: `${base}-` }).catch(() => {});
    }
}
