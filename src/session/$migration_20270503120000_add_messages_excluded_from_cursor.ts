// Converted from $migrate_20270503120000_add_messages_excluded_from_cursor.up.sql — id "20270503120000_add_messages_excluded_from_cursor" matches the pre-procs _migrations record.
const up_sql = "ALTER TABLE messages ADD COLUMN excluded_from_cursor INTEGER NOT NULL DEFAULT 0;\n\n-- Backfill existing synthetic tool-feedback messages so workerLoop's frontier\n-- query stops counting them as new user input. These are runMarkers-emitted\n-- §result:* / §error:* user-rows that exist purely to feed results back\n-- to the model — they should not retrigger another run. (Pre-migration data\n-- used `///` prefix; both forms backfilled for safety on upgraded installs.)\nUPDATE messages\n   SET excluded_from_cursor = 1\n WHERE role = 'user'\n   AND (content LIKE '///result:%' OR content LIKE '///error:%'\n     OR content LIKE '§result:%'   OR content LIKE '§error:%');\n";
const down_sql = "ALTER TABLE messages DROP COLUMN excluded_from_cursor;\n";

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: down_sql }); },
};
