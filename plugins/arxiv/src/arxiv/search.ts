/**
 * Searches public arXiv metadata and abstracts. Plain text searches all fields;
 * use arXiv prefixes such as `ti:`, `au:`, `abs:`, or `cat:` for field queries.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Search text, or an arXiv field query when `raw` is true. */
        query?: string;
        /** Comma-separated arXiv IDs to fetch as one result page. */
        idList?: string;
        /** Pass `query` to arXiv unchanged. @default false */
        raw?: boolean;
        /** Zero-based result offset. @default 0 @minimum 0 */
        start?: number;
        /** Maximum papers. @default 10 @minimum 1 @maximum 100 */
        max?: number;
        /** Sort field. @default "relevance" */
        sortBy?: "relevance" | "lastUpdatedDate" | "submittedDate";
        /** Sort direction. @default "descending" */
        sortOrder?: "ascending" | "descending";
    },
): Promise<types.arxiv.SearchResult> {
    const query = String(opts?.query ?? "").trim();
    const idList = String(opts?.idList ?? "").trim();
    if (!query && !idList) throw new Error("arxiv.search: query or idList is required");
    const start = Math.max(0, opts.start ?? 0);
    const max = Math.max(1, Math.min(opts.max ?? 10, 100));
    const fieldQuery = /(^|[\s(])(ti|au|abs|cat|jr|rn|all|id|submittedDate):/i.test(query);
    const searchQuery = query ? (opts.raw || fieldQuery ? query : `all:${query}`) : "";
    const feed = await ctx.fns.arxiv.api({ params: {
        search_query: searchQuery,
        id_list: idList,
        start: String(start),
        max_results: String(max),
        sortBy: opts.sortBy ?? "relevance",
        sortOrder: opts.sortOrder ?? "descending",
    } });
    if (feed.error) throw new Error(`arxiv.search: ${feed.error}`);
    return {
        total: feed.meta.totalResults,
        start: feed.meta.startIndex ?? start,
        pageSize: feed.meta.itemsPerPage ?? max,
        papers: feed.papers,
    };
}
