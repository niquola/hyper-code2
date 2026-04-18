CREATE TABLE IF NOT EXISTS agents (
    id              TEXT PRIMARY KEY,
    model           TEXT NOT NULL,
    system_prompt   TEXT NOT NULL DEFAULT '',
    tools           TEXT NOT NULL DEFAULT '[]',
    scratchpad      TEXT NOT NULL DEFAULT '{}',
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    agent_id        TEXT NOT NULL,
    idx             INTEGER NOT NULL,
    role            TEXT NOT NULL,
    content         TEXT,
    tool_calls      TEXT,
    tool_call_id    TEXT,
    ts              INTEGER NOT NULL,
    PRIMARY KEY (agent_id, idx)
);

CREATE TABLE IF NOT EXISTS events (
    agent_id        TEXT NOT NULL,
    idx             INTEGER NOT NULL,
    type            TEXT NOT NULL,
    payload         TEXT NOT NULL,
    ts              INTEGER NOT NULL,
    PRIMARY KEY (agent_id, idx)
);

CREATE INDEX IF NOT EXISTS idx_agents_updated ON agents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_content ON messages(content);
