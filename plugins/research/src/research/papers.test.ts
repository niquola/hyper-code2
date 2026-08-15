import { describe, expect, test } from "bun:test";
import papers from "./papers";

describe("research.papers", () => {
    test("normalizes evidence metadata and links", () => {
        const [paper] = papers(null as any, null, { papers: [{
            title: "A trial",
            doi: "10.48550/arXiv.2401.01234",
            url_slug: "a-trial",
            open_access_pdf_url: "https://example.test/paper.pdf",
            has_valid_chat_pdf: true,
            is_retracted: false,
            citation_count: 12,
            badges: { study_type: "rct", large_human_trial: true },
        }] });
        expect(paper).toMatchObject({
            title: "A trial",
            arxiv_id: "2401.01234",
            doi_url: "https://doi.org/10.48550/arXiv.2401.01234",
            consensus_url: "https://consensus.app/papers/a-trial/",
            has_full_text: true,
            study_type: "rct",
            large_human_trial: true,
        });
    });
});
