const up_sql = "ALTER TABLE agents ADD COLUMN workspace_dir TEXT NOT NULL DEFAULT '';\n";

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "ALTER TABLE agents DROP COLUMN workspace_dir;\n" }); },
};