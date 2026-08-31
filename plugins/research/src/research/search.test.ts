import { describe, expect, test } from "bun:test";
import search from "./search";

describe("research.search official API", () => {
    test("maps documented API response and forwards filters", async () => {
        let query: any;
        const ctx: any = { fns: { research: { api: async (opts: any) => {
            query = opts.query;
            return { page: 0, page_size: 3, next_page: 1, is_end: false, results: [{ title: "Trial", abstract: "Abstract", authors: ["A"], doi: "10.1/x", journal_name: "J", publish_year: 2025, citation_count: 7, study_type: "rct", sample_size: 100, full_text_chunks: ["Relevant excerpt"], sjr_best_quartile: 1 }] };
        } } } };
        const result = await search(ctx, null, { query: "creatine memory", limit: 3, filters: { human: true }, include_full_text_chunks: true });
        expect(query).toMatchObject({ query: "creatine memory", page_size: 3, human: true, include_full_text_chunks: true });
        expect(result.results[0]).toMatchObject({ title: "Trial", abstract: "Abstract", has_full_text: true, rigorous_journal: true, sample_size: 100 });
        expect(result.next_page).toBe(1);
    });
});
