// Converted from $migrate_20270410120000_add_messages_excluded.up.sql — id "20270410120000_add_messages_excluded" matches the pre-procs _migrations record.
const up_sql = "ALTER TABLE messages ADD COLUMN excluded_from_llm INTEGER NOT NULL DEFAULT 0;\n";

export default {
    up: (ctx: Context) => { ctx.fns.procs.db.exec({ sql: up_sql }); },
};
