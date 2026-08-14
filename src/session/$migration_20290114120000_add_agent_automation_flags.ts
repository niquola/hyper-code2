const up_sql = `
ALTER TABLE agents ADD COLUMN reflection_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE agents ADD COLUMN sleep_enabled BOOLEAN NOT NULL DEFAULT TRUE;
`;

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "ALTER TABLE agents DROP COLUMN sleep_enabled; ALTER TABLE agents DROP COLUMN reflection_enabled;" }); },
};
