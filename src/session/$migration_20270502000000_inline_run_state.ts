// Converted from $migrate_20270502000000_inline_run_state.up.sql — id "20270502000000_inline_run_state" matches the pre-procs _migrations record.
const up_sql = "-- Drop separate agent_jobs queue; debounce + run state live on the agents row.\n-- One source of truth for \"is this agent doing something\": agents.run_state.\n\nDROP TABLE IF EXISTS agent_jobs;\n\nALTER TABLE agents ADD COLUMN next_run_at            BIGINT;\nALTER TABLE agents ADD COLUMN last_processed_msg_idx INTEGER NOT NULL DEFAULT -1;\nALTER TABLE agents ADD COLUMN run_state              TEXT    NOT NULL DEFAULT 'idle';\nALTER TABLE agents ADD COLUMN run_started_at         BIGINT;\nALTER TABLE agents ADD COLUMN last_error             TEXT;\n\n-- Backfill cursor so existing agents don't re-process their entire history on first run.\nUPDATE agents\n   SET last_processed_msg_idx = COALESCE(\n       (SELECT MAX(idx) FROM messages WHERE messages.agent_id = agents.id),\n       -1\n   );\n";

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
};
