const up_sql = "ALTER TABLE agents ADD COLUMN status_line TEXT NOT NULL DEFAULT '';\nALTER TABLE agents ADD COLUMN status_line_every INTEGER NOT NULL DEFAULT 1;\n";

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "ALTER TABLE agents DROP COLUMN status_line_every;\nALTER TABLE agents DROP COLUMN status_line;\n" }); },
};
