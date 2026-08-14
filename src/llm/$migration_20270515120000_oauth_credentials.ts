const up_sql = `CREATE TABLE IF NOT EXISTS oauth_credentials (
    provider    TEXT PRIMARY KEY,
    access_enc  TEXT NOT NULL,
    refresh_enc TEXT NOT NULL,
    expires_at  BIGINT NOT NULL,
    scopes      TEXT,
    metadata    TEXT NOT NULL DEFAULT '{}',
    version     BIGINT NOT NULL DEFAULT 1,
    created_at  BIGINT NOT NULL,
    updated_at  BIGINT NOT NULL
);`;

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "DROP TABLE IF EXISTS oauth_credentials" }); },
};
