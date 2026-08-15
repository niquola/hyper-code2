import { describe, expect, test } from "bun:test";
import api from "./api";

describe("arxiv.api", () => {
    test("parses one public Atom paper", async () => {
        const ctx: any = { state: {} };
        const result = await api(ctx, null, { params: { id_list: "1706.03762" } });
        expect(result.error).toBeNull();
        expect(result.papers[0]).toMatchObject({ id: "1706.03762" });
        expect(result.papers[0].title).toContain("Attention Is All You Need");
    }, 20_000);
});
