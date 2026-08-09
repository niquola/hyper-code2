// Converted from $migrate_20260428150000_add_forks.up.sql — id "20260428150000_add_forks" matches the pre-procs _migrations record.
const up_sql = "ALTER TABLE agents ADD COLUMN parent_id TEXT;\nALTER TABLE agents ADD COLUMN fork_offset INTEGER;\nCREATE INDEX IF NOT EXISTS idx_agents_parent_id ON agents(parent_id);\n";

export default {
    up: (ctx: Context) => { ctx.fns.procs.db.exec({ sql: up_sql }); },
};
