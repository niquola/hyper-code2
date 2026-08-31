const up_sql = `
CREATE TABLE IF NOT EXISTS local_secrets (
    namespace TEXT NOT NULL,
    name TEXT NOT NULL,
    value_enc TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'local',
    version BIGINT NOT NULL DEFAULT 1,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL,
    PRIMARY KEY (namespace, name)
);
`;

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "DROP TABLE IF EXISTS local_secrets" }); },
};
