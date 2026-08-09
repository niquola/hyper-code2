// One BM25 search hit over the messages table (session.searchBm25).
export type Bm25Hit = {
    agentId: string;
    idx: number;
    role: string;
    ts: number;
    score: number;
    snippet: string;   // content excerpt with <b>…</b> highlights
};
