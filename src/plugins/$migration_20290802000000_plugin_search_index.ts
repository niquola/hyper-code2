const upSql = `
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS plugin_docs (
    name TEXT PRIMARY KEY,
    label TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    namespaces JSONB NOT NULL DEFAULT '[]',
    skill_text TEXT NOT NULL DEFAULT '',
    search_text TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL,
    localized_text TEXT NOT NULL DEFAULT '',
    localization_provider TEXT,
    localization_model TEXT,
    localization_locales TEXT,
    localization_hash TEXT,
    embedding public.halfvec(1536),
    embedding_provider TEXT,
    embedding_model TEXT,
    updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS plugin_docs_bm25 ON plugin_docs USING bm25
    (name, label, description, skill_text, search_text) WITH (key_field = 'name');
CREATE INDEX IF NOT EXISTS plugin_docs_embedding_hnsw ON plugin_docs
    USING hnsw (embedding public.halfvec_cosine_ops);
`;

/** Creates the durable multilingual hybrid-search index for mounted plugins. */
export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: upSql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "DROP TABLE IF EXISTS plugin_docs" }); },
};
