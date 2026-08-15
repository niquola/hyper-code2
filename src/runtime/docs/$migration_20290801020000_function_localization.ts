/** Adds durable multilingual retrieval text and cache identity to functions. */
export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: `
        ALTER TABLE functions ADD COLUMN localized_text TEXT NOT NULL DEFAULT '';
        ALTER TABLE functions ADD COLUMN localization_provider TEXT;
        ALTER TABLE functions ADD COLUMN localization_model TEXT;
        ALTER TABLE functions ADD COLUMN localization_locales TEXT;
        ALTER TABLE functions ADD COLUMN localization_hash TEXT;
    ` }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: `
        ALTER TABLE functions DROP COLUMN localization_hash;
        ALTER TABLE functions DROP COLUMN localization_locales;
        ALTER TABLE functions DROP COLUMN localization_model;
        ALTER TABLE functions DROP COLUMN localization_provider;
        ALTER TABLE functions DROP COLUMN localized_text;
    ` }); },
};
