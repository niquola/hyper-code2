const up_sql = `
ALTER TABLE agents
ADD COLUMN visibility TEXT NOT NULL DEFAULT 'nav'
CHECK (visibility IN ('nav', 'team', 'hidden'));

UPDATE agents SET visibility = 'team' WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agents_visibility_updated
ON agents(visibility, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_agents_parent_visibility
ON agents(parent_id, visibility);
`;

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "DROP INDEX IF EXISTS idx_agents_parent_visibility; DROP INDEX IF EXISTS idx_agents_visibility_updated; ALTER TABLE agents DROP COLUMN visibility;" }); },
};
