// Converted from $migrate_20270504120000_drop_tool_calls.up.sql — id "20270504120000_drop_tool_calls" matches the pre-procs _migrations record.
const up_sql = "-- Markers protocol is the only protocol now. Wipe legacy tool-calls data\n-- (sessions where role='tool' messages or assistant.tool_calls existed) and\n-- drop the columns. Runtime no longer reads or writes them.\n--\n-- We truncate all session data wholesale rather than try to salvage half of\n-- old transcripts: the old agents had a different wire format and their\n-- transcripts only make sense under tool-calls semantics.\n\nDELETE FROM events;\nDELETE FROM messages;\nDELETE FROM agents;\n\nALTER TABLE messages DROP COLUMN tool_calls;\nALTER TABLE messages DROP COLUMN tool_call_id;\nALTER TABLE agents DROP COLUMN tools;\n";
const down_sql = "ALTER TABLE messages ADD COLUMN tool_calls TEXT;\nALTER TABLE messages ADD COLUMN tool_call_id TEXT;\nALTER TABLE agents ADD COLUMN tools TEXT NOT NULL DEFAULT '[]';\n";

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: down_sql }); },
};
