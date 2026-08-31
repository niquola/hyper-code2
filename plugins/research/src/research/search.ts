/**
 * Searches the official Consensus API and returns ranked peer-reviewed papers,
 * abstracts, study metadata, and optional query-relevant full-text snippets.
 */
export default async function (
    ctx: Context,
    _session: Session | null,
    opts: {
        /** Natural-language research query. */ query: string;
        /** Result page, zero-indexed. @default 0 @minimum 0 @maximum 49 */ page?: number;
        /** Papers requested per page; the plan may cap it. @default 10 @minimum 1 @maximum 100 */ limit?: number;
        /** Evidence and publication filters. */ filters?: types.research.Filters;
        /** Include semantic scores for top results. @default false */ include_semantic_score?: boolean;
        /** Request query-relevant full-text excerpts; currently Enterprise-only. @default false */ include_full_text_chunks?: boolean;
    },
): Promise<types.research.SearchResult> {
    const query = String(opts?.query ?? "").trim();
    if (!query) throw new Error("research.search: query is required");
    const page = Math.max(0, Math.min(opts.page ?? 0, 49));
    const limit = Math.max(1, Math.min(opts.limit ?? 10, 100));
    const raw: any = await ctx.fns.research.api({ query: {
        query,
        page,
        page_size: limit,
        ...(opts.filters ?? {}),
        include_semantic_score: opts.include_semantic_score,
        include_full_text_chunks: opts.include_full_text_chunks,
    } });
    const results: types.research.Paper[] = (raw.results ?? []).map((paper: any) => ({
        title: paper.title,
        abstract: paper.abstract,
        authors: paper.authors,
        year: paper.publish_year,
        publish_date: paper.publish_date,
        journal: paper.journal_name,
        publisher: paper.publisher_name,
        doi: paper.doi,
        doi_url: paper.doi ? `https://doi.org/${paper.doi}` : undefined,
        consensus_url: paper.url,
        citations: paper.citation_count,
        influential_citation_count: paper.influential_citation_count,
        semantic_score: paper.semantic_score,
        study_type: paper.study_type,
        study_count: paper.study_count,
        sample_size: paper.sample_size,
        population_type: paper.population_type,
        countries_of_study: paper.countries_of_study,
        study_duration_days: paper.study_duration_days,
        institutions: paper.institutions,
        sjr_best_quartile: paper.sjr_best_quartile,
        is_preprint: paper.is_preprint,
        takeaway: paper.takeaway,
        full_text_chunks: paper.full_text_chunks,
        has_full_text: Boolean(paper.full_text_chunks?.length),
        is_retracted: false,
        highly_cited: false,
        rigorous_journal: Number(paper.sjr_best_quartile) === 1,
        large_human_trial: false,
        animal_trial: paper.population_type === "animal",
        arxiv_id: paper.doi?.match(/10\.48550\/arxiv\.(.+)$/i)?.[1],
    }));
    return { query, page: Number(raw.page ?? page), page_size: Number(raw.page_size ?? limit), next_page: raw.next_page ?? null, is_end: Boolean(raw.is_end), count: results.length, results };
}
