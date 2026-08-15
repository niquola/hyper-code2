export type SearchResult = {
    query: string;
    thread_id: string;
    interaction_id: string;
    thread_url: string;
    total_count: number;
    count: number;
    results: types.research.Paper[];
};
