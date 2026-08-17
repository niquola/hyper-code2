const upSql = `ALTER TABLE agents ADD COLUMN IF NOT EXISTS reasoning_effort TEXT NOT NULL DEFAULT 'auto';`;
const downSql = `ALTER TABLE agents DROP COLUMN IF EXISTS reasoning_effort;`;

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: upSql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: downSql }); },
};
