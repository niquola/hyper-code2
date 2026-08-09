// Converted from $migrate_20260418000000_init.up.sql — id "20260418000000_init" matches the pre-procs _migrations record.
const up_sql = "CREATE TABLE IF NOT EXISTS agents (\n    id              TEXT PRIMARY KEY,\n    model           TEXT NOT NULL,\n    system_prompt   TEXT NOT NULL DEFAULT '',\n    tools           TEXT NOT NULL DEFAULT '[]',\n    scratchpad      TEXT NOT NULL DEFAULT '{}',\n    created_at      INTEGER NOT NULL,\n    updated_at      INTEGER NOT NULL\n);\n\nCREATE TABLE IF NOT EXISTS messages (\n    agent_id        TEXT NOT NULL,\n    idx             INTEGER NOT NULL,\n    role            TEXT NOT NULL,\n    content         TEXT,\n    tool_calls      TEXT,\n    tool_call_id    TEXT,\n    ts              INTEGER NOT NULL,\n    PRIMARY KEY (agent_id, idx)\n);\n\nCREATE TABLE IF NOT EXISTS events (\n    agent_id        TEXT NOT NULL,\n    idx             INTEGER NOT NULL,\n    type            TEXT NOT NULL,\n    payload         TEXT NOT NULL,\n    ts              INTEGER NOT NULL,\n    PRIMARY KEY (agent_id, idx)\n);\n\nCREATE INDEX IF NOT EXISTS idx_agents_updated ON agents(updated_at DESC);\nCREATE INDEX IF NOT EXISTS idx_messages_content ON messages(content);\n";
const down_sql = "DROP INDEX IF EXISTS idx_messages_content;\nDROP INDEX IF EXISTS idx_agents_updated;\nDROP TABLE IF EXISTS events;\nDROP TABLE IF EXISTS messages;\nDROP TABLE IF EXISTS agents;\n";

export default {
    up: (ctx: Context) => { ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: (ctx: Context) => { ctx.fns.procs.db.exec({ sql: down_sql }); },
};
