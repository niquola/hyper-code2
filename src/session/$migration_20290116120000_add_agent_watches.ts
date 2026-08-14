const up_sql = `
CREATE TABLE agent_watches (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  predicate TEXT NOT NULL,
  opts JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL,
  interval_ms BIGINT NOT NULL,
  next_check_at BIGINT NOT NULL,
  timeout_at BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at BIGINT NOT NULL,
  finished_at BIGINT
);
CREATE INDEX idx_agent_watches_due ON agent_watches(next_check_at) WHERE status = 'active';
CREATE INDEX idx_agent_watches_agent ON agent_watches(agent_id);
`;

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "DROP TABLE agent_watches;" }); },
};
