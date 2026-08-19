const upSql = `
CREATE SCHEMA IF NOT EXISTS knowledge;

CREATE TABLE IF NOT EXISTS knowledge.entities (
    id text PRIMARY KEY,
    type text NOT NULL,
    data jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS knowledge_entities_type_idx ON knowledge.entities(type);
CREATE INDEX IF NOT EXISTS knowledge_entities_data_gin ON knowledge.entities USING gin(data);

CREATE TABLE IF NOT EXISTS knowledge.provenance (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject text NOT NULL REFERENCES knowledge.entities(id) ON DELETE CASCADE,
    attribute text NOT NULL,
    value jsonb,
    source text NOT NULL,
    url text,
    evidence text,
    confidence double precision,
    observed_at timestamptz,
    status text NOT NULL DEFAULT 'observed',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(subject, attribute, source, url, evidence)
);
CREATE INDEX IF NOT EXISTS knowledge_provenance_subject_idx ON knowledge.provenance(subject, attribute);

CREATE TABLE IF NOT EXISTS knowledge.relations (
    subject text NOT NULL REFERENCES knowledge.entities(id) ON DELETE CASCADE,
    predicate text NOT NULL,
    object text NOT NULL,
    PRIMARY KEY(subject, predicate, object)
);
CREATE INDEX IF NOT EXISTS knowledge_relations_object_idx ON knowledge.relations(object, predicate);

CREATE TABLE IF NOT EXISTS knowledge.search (
    id text PRIMARY KEY REFERENCES knowledge.entities(id) ON DELETE CASCADE,
    type text NOT NULL,
    title text,
    summary text,
    description text,
    body text,
    classes text,
    search_vector tsvector,
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS knowledge_search_vector_idx ON knowledge.search USING gin(search_vector);
CREATE INDEX IF NOT EXISTS knowledge_search_type_idx ON knowledge.search(type);
`;

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: upSql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "DROP SCHEMA IF EXISTS knowledge CASCADE" }); },
};
