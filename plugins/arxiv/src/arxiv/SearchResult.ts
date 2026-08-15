export type SearchResult = {
    total: number | null;
    start: number;
    pageSize: number;
    papers: types.arxiv.Paper[];
};
