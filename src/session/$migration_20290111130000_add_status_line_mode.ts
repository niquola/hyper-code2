const up_sql = "ALTER TABLE agents ADD COLUMN status_line_mode TEXT NOT NULL DEFAULT 'global';\nALTER TABLE agents ADD CONSTRAINT agents_status_line_mode_check CHECK (status_line_mode IN ('global', 'custom', 'off'));\nUPDATE agents SET status_line_mode = 'custom' WHERE status_line <> '';";

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "ALTER TABLE agents DROP CONSTRAINT agents_status_line_mode_check;\nALTER TABLE agents DROP COLUMN status_line_mode;" }); },
};
