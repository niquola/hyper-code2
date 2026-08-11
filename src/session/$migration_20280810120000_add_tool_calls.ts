// Native JSON tool calls need what marker text never did: identity. Anthropic
// pairs tool_result to tool_use by id, OpenAI pairs a role:"tool" message to a
// tool_call_id, and with several calls in one reply nothing in the prose says
// which result answers which call. So the transcript stores them.
//
// (The 20270504 migration dropped these columns when markers became the only
// protocol, and wiped the transcripts with them. This one only adds columns —
// marker transcripts are untouched and simply leave them NULL.)
const up_sql = `
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tool_calls   JSONB;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS tool_call_id TEXT;

-- Which envelope an agent uses, and (optionally) the subset of tools it may
-- reach. Existing agents keep markers, so nothing in flight changes protocol
-- under itself.
ALTER TABLE agents   ADD COLUMN IF NOT EXISTS protocol TEXT NOT NULL DEFAULT 'markers';
ALTER TABLE agents   ADD COLUMN IF NOT EXISTS tools    JSONB;
`;

const down_sql = `
ALTER TABLE messages DROP COLUMN IF EXISTS tool_calls;
ALTER TABLE messages DROP COLUMN IF EXISTS tool_call_id;
ALTER TABLE agents   DROP COLUMN IF EXISTS protocol;
ALTER TABLE agents   DROP COLUMN IF EXISTS tools;
`;

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: down_sql }); },
};
