-- Drop separate agent_jobs queue; debounce + run state live on the agents row.
-- One source of truth for "is this agent doing something": agents.run_state.

DROP TABLE IF EXISTS agent_jobs;

ALTER TABLE agents ADD COLUMN next_run_at            INTEGER;
ALTER TABLE agents ADD COLUMN last_processed_msg_idx INTEGER NOT NULL DEFAULT -1;
ALTER TABLE agents ADD COLUMN run_state              TEXT    NOT NULL DEFAULT 'idle';
ALTER TABLE agents ADD COLUMN run_started_at         INTEGER;
ALTER TABLE agents ADD COLUMN last_error             TEXT;

-- Backfill cursor so existing agents don't re-process their entire history on first run.
UPDATE agents
   SET last_processed_msg_idx = COALESCE(
       (SELECT MAX(idx) FROM messages WHERE messages.agent_id = agents.id),
       -1
   );
