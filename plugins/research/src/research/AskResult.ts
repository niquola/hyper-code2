export type AskResult = {
    query: string;
    verdict: string;
    meter: { raw: string } | null;
    answer_md: string;
    answer_text: string;
    citations: types.research.Citation[];
    papers: types.research.Paper[];
    full_text_paper_ids: string[];
    num_results_analyzed?: number;
    thread_id: string;
    interaction_id: string;
    thread_url: string;
};
