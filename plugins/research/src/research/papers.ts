/**
 * Normalizes raw Consensus paper records into stable evidence metadata. Usually
 * called by research.search or research.ask; use directly for a raw API payload.
 */
export default function (
    _ctx: Context,
    _session: Session | null,
    opts: { /** Raw `papers` array returned by Consensus. */ papers: any[] },
): types.research.Paper[] {
    return (opts.papers ?? []).map((raw: any) => {
        const badges = raw.badges ?? {};
        const doi = raw.doi ? String(raw.doi) : undefined;
        const arxiv = doi?.match(/10\.48550\/arxiv\.(.+)$/i)?.[1];
        return {
            title: raw.title,
            authors: raw.authors,
            primary_author: raw.primary_author,
            year: raw.year ?? raw.publish_year,
            publish_date: raw.publish_date,
            journal: raw.journal,
            publisher: raw.publisher_name,
            doi,
            doi_url: doi ? `https://doi.org/${doi}` : undefined,
            open_access_pdf: raw.open_access_pdf_url || undefined,
            has_full_text: Boolean(raw.has_valid_chat_pdf),
            arxiv_id: arxiv,
            is_retracted: Boolean(raw.is_retracted),
            citations: raw.citation_count,
            study_type: badges.study_type,
            study_count: badges.study_count,
            highly_cited: Boolean(badges.highly_cited_paper),
            rigorous_journal: Boolean(badges.very_rigorous_journal || badges.rigorous_journal),
            large_human_trial: Boolean(badges.large_human_trial),
            animal_trial: Boolean(badges.animal_trial),
            takeaway: raw.display_text,
            paper_id: raw.paper_id,
            doc_id: raw.doc_id,
            consensus_url: raw.url_slug ? `https://consensus.app/papers/${raw.url_slug}/` : undefined,
        };
    });
}
