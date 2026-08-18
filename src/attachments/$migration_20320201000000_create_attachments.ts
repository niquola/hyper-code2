const up_sql = `
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    message_idx INTEGER,
    blob_hash TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    kind TEXT NOT NULL,
    extracted_text TEXT,
    created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(agent_id, message_idx);
CREATE INDEX IF NOT EXISTS idx_attachments_blob ON attachments(blob_hash);
`;

/** Creates metadata for filesystem-backed chat attachments. */
export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "DROP TABLE IF EXISTS attachments;" }); },
};
