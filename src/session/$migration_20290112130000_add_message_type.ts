const up_sql = `
ALTER TABLE messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'message';
CREATE INDEX idx_messages_agent_type ON messages(agent_id, message_type);
`;

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "DROP INDEX IF EXISTS idx_messages_agent_type; ALTER TABLE messages DROP COLUMN message_type;" }); },
};
