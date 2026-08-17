const upSql = `
CREATE TABLE cron_jobs (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    fn TEXT NOT NULL,
    args JSONB NOT NULL DEFAULT '{}'::jsonb,
    run_at BIGINT NOT NULL,
    every_ms BIGINT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'error')),
    started_at BIGINT,
    finished_at BIGINT,
    result JSONB,
    error TEXT,
    created_at BIGINT NOT NULL
);
CREATE INDEX cron_jobs_due_idx ON cron_jobs(run_at, id) WHERE status = 'pending';
CREATE INDEX cron_jobs_name_idx ON cron_jobs(name, id DESC);
`;

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: upSql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "DROP TABLE IF EXISTS cron_jobs;" }); },
};
