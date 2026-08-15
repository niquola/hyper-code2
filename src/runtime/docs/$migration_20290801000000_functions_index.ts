const upSql = `
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS functions (
    name TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    doc TEXT NOT NULL DEFAULT '',
    signature TEXT NOT NULL DEFAULT '',
    opts_type TEXT NOT NULL DEFAULT '',
    return_type TEXT NOT NULL DEFAULT '',
    params_schema JSONB NOT NULL DEFAULT '{}',
    rel TEXT NOT NULL DEFAULT '',
    line INTEGER,
    search_text TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL,
    embedding public.halfvec(1536),
    embedding_provider TEXT,
    embedding_model TEXT,
    updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS functions_bm25 ON functions USING bm25
    (name, namespace, summary, doc, signature, search_text) WITH (key_field = 'name');
CREATE INDEX IF NOT EXISTS functions_embedding_hnsw ON functions
    USING hnsw (embedding public.halfvec_cosine_ops);
CREATE INDEX IF NOT EXISTS functions_namespace_idx ON functions(namespace);
`;

/** Creates the durable hybrid-search index for runtime functions. */
export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: upSql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "DROP TABLE IF EXISTS functions" }); },
};
