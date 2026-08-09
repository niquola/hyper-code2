// Converted from $migrate_20260428130000_add_archived_at.up.sql — id "20260428130000_add_archived_at" matches the pre-procs _migrations record.
const up_sql = "ALTER TABLE agents ADD COLUMN archived_at INTEGER;\n";

export default {
    up: (ctx: Context) => { ctx.fns.procs.db.exec({ sql: up_sql }); },
};
