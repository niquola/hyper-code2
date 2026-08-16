// Quota belongs to a credential, not to a provider — so a second ChatGPT or
// Claude login must be a first-class thing, not a second installation. The
// primary key moves from provider to (provider, account); everything that
// exists today becomes account "default", which is exactly what the old
// single-credential behaviour meant.
const up_sql = `
ALTER TABLE oauth_credentials ADD COLUMN IF NOT EXISTS account TEXT NOT NULL DEFAULT 'default';
ALTER TABLE oauth_credentials ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE oauth_credentials DROP CONSTRAINT IF EXISTS oauth_credentials_pkey;
ALTER TABLE oauth_credentials ADD PRIMARY KEY (provider, account);
`;

const down_sql = `
DELETE FROM oauth_credentials WHERE account <> 'default';
ALTER TABLE oauth_credentials DROP CONSTRAINT IF EXISTS oauth_credentials_pkey;
ALTER TABLE oauth_credentials ADD PRIMARY KEY (provider);
ALTER TABLE oauth_credentials DROP COLUMN IF EXISTS account;
ALTER TABLE oauth_credentials DROP COLUMN IF EXISTS label;
`;

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: up_sql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: down_sql }); },
};
