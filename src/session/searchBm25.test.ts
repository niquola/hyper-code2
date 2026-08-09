import { test, expect, describe } from "bun:test";
import { mkTestCtx } from "../_testCtx.entry";

describe("session.searchBm25", () => {
    test("finds by keyword, ranks by relevance, filters by agent", async () => {
        const ctx = await mkTestCtx();
        const a = await ctx.fns.agent.start({ model: "mock:echo" });
        const b = await ctx.fns.agent.start({ model: "mock:echo" });
        await ctx.fns.session.appendMessage({ id: a.id, message: { role: "user", content: "let us discuss the walrus migration plan" } });
        await ctx.fns.session.appendMessage({ id: a.id, message: { role: "assistant", content: "walrus walrus walrus — the migration of the walrus is key" } });
        await ctx.fns.session.appendMessage({ id: b.id, message: { role: "user", content: "unrelated giraffe news" } });

        const hits = await ctx.fns.session.searchBm25({ q: "walrus" });
        expect(hits.length).toBe(2);
        // The walrus-heavy assistant message outranks the single mention.
        expect(hits[0]!.role).toBe("assistant");
        expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score);
        expect(hits[0]!.snippet).toContain("<b>");

        const onlyB = await ctx.fns.session.searchBm25({ q: "giraffe", agentId: b.id });
        expect(onlyB.length).toBe(1);
        expect(onlyB[0]!.agentId).toBe(b.id);
        expect(await ctx.fns.session.searchBm25({ q: "giraffe", agentId: a.id })).toEqual([]);
    });

    test("GET /search renders hits", async () => {
        const ctx = await mkTestCtx();
        const a = await ctx.fns.agent.start({ model: "mock:echo" });
        await ctx.fns.session.appendMessage({ id: a.id, message: { role: "user", content: "pelican in the harbor" } });
        const res = await ctx.fns.procs.http.dispatch({ url: "/search?q=pelican" });
        expect(res.status).toBe(200);
        const html = await res.text();
        expect(html).toContain("pelican");
        expect(html).toContain(`/agent/${a.id}`);
    });
});
