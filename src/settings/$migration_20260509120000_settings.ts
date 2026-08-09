// Converted from $migrate_20260509120000_settings.up.sql — id "20260509120000_settings" matches the pre-procs _migrations record.
const up_sql = "CREATE TABLE IF NOT EXISTS settings (\n    module      TEXT NOT NULL,\n    scope_type  TEXT NOT NULL,\n    scope_id    TEXT NOT NULL DEFAULT '',\n    key         TEXT NOT NULL,\n    value       TEXT NOT NULL,\n    is_secret   INTEGER NOT NULL DEFAULT 0,\n    updated_at  BIGINT NOT NULL,\n    PRIMARY KEY (module, scope_type, scope_id, key)\n);\n\nCREATE INDEX IF NOT EXISTS idx_settings_scope ON settings(scope_type, scope_id, module);\n";

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
};
