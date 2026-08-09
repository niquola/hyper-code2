// Converted from $migrate_20270501123000_add_kv.up.sql — id "20270501123000_add_kv" matches the pre-procs _migrations record.
const up_sql = "CREATE TABLE IF NOT EXISTS kv (\n    key   TEXT PRIMARY KEY,\n    value TEXT NOT NULL\n);\n";

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
};
