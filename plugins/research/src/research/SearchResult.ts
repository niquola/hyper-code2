export type SearchResult = {
    query: string;
    page: number;
    page_size: number;
    next_page: number | null;
    is_end: boolean;
    count: number;
    results: types.research.Paper[];
};
