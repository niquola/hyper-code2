const up_sql = `
ALTER TABLE agents ADD COLUMN run_token TEXT;
ALTER TABLE agents ADD COLUMN run_heartbeat_at BIGINT;
ALTER TABLE agents ADD COLUMN stale_recovery_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_agents_stale_run ON agents(run_heartbeat_at) WHERE run_state = 'running';
`;

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: `
        DROP INDEX IF EXISTS idx_agents_stale_run;
        ALTER TABLE agents DROP COLUMN IF EXISTS stale_recovery_count;
        ALTER TABLE agents DROP COLUMN IF EXISTS run_heartbeat_at;
        ALTER TABLE agents DROP COLUMN IF EXISTS run_token;
    ` }); },
};
