// BM25 full-text search over transcripts (ParadeDB pg_search).
// messages has a composite PK (agent_id, idx) but bm25 needs a single unique
// key_field — add a generated identity id (backfills existing rows) and index
// content + the filterable columns.
const up_sql = `
ALTER TABLE messages ADD COLUMN IF NOT EXISTS id BIGINT GENERATED ALWAYS AS IDENTITY;
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_id ON messages(id);
CREATE INDEX IF NOT EXISTS messages_bm25 ON messages USING bm25 (id, agent_id, role, content) WITH (key_field = 'id');
`;
const down_sql = `
DROP INDEX IF EXISTS messages_bm25;
DROP INDEX IF EXISTS idx_messages_id;
ALTER TABLE messages DROP COLUMN IF EXISTS id;
`;

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: down_sql }); },
};
