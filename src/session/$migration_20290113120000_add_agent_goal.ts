const up_sql = "ALTER TABLE agents ADD COLUMN goal JSONB;\n";

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "ALTER TABLE agents DROP COLUMN goal;\n" }); },
};
