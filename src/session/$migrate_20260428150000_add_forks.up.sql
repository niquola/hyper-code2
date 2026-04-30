ALTER TABLE agents ADD COLUMN parent_id TEXT;
ALTER TABLE agents ADD COLUMN fork_offset INTEGER;
CREATE INDEX IF NOT EXISTS idx_agents_parent_id ON agents(parent_id);
