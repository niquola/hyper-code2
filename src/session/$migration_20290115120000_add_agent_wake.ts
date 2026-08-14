const up_sql = `
ALTER TABLE agents ADD COLUMN wake_at BIGINT;
ALTER TABLE agents ADD COLUMN wake_reason TEXT;
CREATE INDEX idx_agents_wake_at ON agents(wake_at) WHERE wake_at IS NOT NULL;
`;

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "DROP INDEX IF EXISTS idx_agents_wake_at; ALTER TABLE agents DROP COLUMN wake_reason; ALTER TABLE agents DROP COLUMN wake_at;" }); },
};
