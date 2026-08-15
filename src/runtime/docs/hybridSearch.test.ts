import { expect, test } from "bun:test";
import { testCtx } from "../../$test";

const ctx = await testCtx();

test("function index caches unchanged docs by content hash", async () => {
    await ctx.fns.settings.set({ module: "embeddings", scopeType: "global", key: "provider", value: "off" });
    const first = await ctx.fns.runtime.docs.index({});
    const before = await ctx.fns.procs.db.select({ sql: "SELECT name, content_hash FROM functions ORDER BY name", params: [] });
    const second = await ctx.fns.runtime.docs.index({});
    const after = await ctx.fns.procs.db.select({ sql: "SELECT name, content_hash FROM functions ORDER BY name", params: [] });
    expect(first.indexed).toBeGreaterThan(500);
    expect(second.embedded).toBe(0);
    expect(after).toEqual(before);
});

test("BM25 search and lexical fallback find the same intended function", async () => {
    await ctx.fns.runtime.docs.index({});
    const bm25 = await ctx.fns.runtime.docs.search({ query: "read only duckdb sql", mode: "bm25", limit: 3 });
    const lexical = await ctx.fns.runtime.docs.search({ query: "read only duckdb sql", mode: "lexical", limit: 3 });
    expect(bm25[0]?.name).toBe("duckdb.query");
    expect(lexical[0]?.name).toBe("duckdb.query");
    expect(bm25[0]?.bm25).toBeGreaterThan(0);
});

test("hybrid mode degrades to BM25 while embeddings are off", async () => {
    await ctx.fns.settings.set({ module: "embeddings", scopeType: "global", key: "provider", value: "off" });
    const hits = await ctx.fns.runtime.docs.search({ query: "send telegram message", mode: "hybrid", limit: 3 });
    expect(hits[0]?.name).toBe("telegram.send");
    expect(hits[0]?.similarity).toBeNull();
});
