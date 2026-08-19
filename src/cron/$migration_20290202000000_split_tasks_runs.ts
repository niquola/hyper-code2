const upSql = `
CREATE TABLE cron_tasks (
    name TEXT PRIMARY KEY,
    fn TEXT NOT NULL,
    args JSONB NOT NULL DEFAULT '{}'::jsonb,
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('interval', 'once')),
    every_ms BIGINT,
    next_run_at BIGINT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    state TEXT NOT NULL DEFAULT 'idle' CHECK (state IN ('idle', 'running')),
    source TEXT NOT NULL DEFAULT 'adhoc' CHECK (source IN ('adhoc', 'declared')),
    source_file TEXT,
    definition_hash TEXT,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE TABLE cron_runs (
    id BIGSERIAL PRIMARY KEY,
    task_name TEXT NOT NULL,
    fn TEXT NOT NULL,
    args JSONB NOT NULL DEFAULT '{}'::jsonb,
    scheduled_at BIGINT NOT NULL,
    started_at BIGINT NOT NULL,
    finished_at BIGINT,
    status TEXT NOT NULL CHECK (status IN ('running', 'done', 'error')),
    result JSONB,
    error TEXT,
    created_at BIGINT NOT NULL
);

INSERT INTO cron_tasks (name, fn, args, schedule_type, every_ms, next_run_at, enabled, state, source, created_at, updated_at)
SELECT DISTINCT ON (name)
       name, fn, args,
       CASE WHEN every_ms IS NULL THEN 'once' ELSE 'interval' END,
       every_ms,
       CASE WHEN status = 'pending' THEN run_at ELSE NULL END,
       status = 'pending',
       'idle', 'adhoc', created_at, GREATEST(created_at, COALESCE(finished_at, started_at, run_at))
  FROM cron_jobs
 ORDER BY name, (status = 'pending') DESC, id DESC;

INSERT INTO cron_runs (id, task_name, fn, args, scheduled_at, started_at, finished_at, status, result, error, created_at)
SELECT id, name, fn, args, run_at, COALESCE(started_at, run_at),
       CASE WHEN status = 'running' THEN COALESCE(finished_at, extract(epoch from clock_timestamp())::bigint * 1000) ELSE finished_at END,
       CASE WHEN status = 'running' THEN 'error' ELSE status END,
       result,
       CASE WHEN status = 'running' THEN COALESCE(error, 'migrated while run was active') ELSE error END,
       created_at
  FROM cron_jobs
 WHERE status IN ('running', 'done', 'error');

SELECT setval(pg_get_serial_sequence('cron_runs', 'id'), COALESCE((SELECT MAX(id) FROM cron_runs), 1), EXISTS (SELECT 1 FROM cron_runs));
CREATE INDEX cron_tasks_due_idx ON cron_tasks(next_run_at, name) WHERE enabled AND state = 'idle' AND next_run_at IS NOT NULL;
CREATE INDEX cron_runs_task_idx ON cron_runs(task_name, id DESC);
DROP TABLE cron_jobs;
`;

const downSql = `
CREATE TABLE cron_jobs (
    id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, fn TEXT NOT NULL,
    args JSONB NOT NULL DEFAULT '{}'::jsonb, run_at BIGINT NOT NULL,
    every_ms BIGINT, status TEXT NOT NULL, started_at BIGINT, finished_at BIGINT,
    result JSONB, error TEXT, created_at BIGINT NOT NULL
);
INSERT INTO cron_jobs (name, fn, args, run_at, every_ms, status, started_at, finished_at, result, error, created_at)
SELECT task_name, fn, args, scheduled_at, NULL, status, started_at, finished_at, result, error, created_at FROM cron_runs;
INSERT INTO cron_jobs (name, fn, args, run_at, every_ms, status, created_at)
SELECT name, fn, args, next_run_at, every_ms, 'pending', created_at FROM cron_tasks WHERE enabled AND next_run_at IS NOT NULL;
DROP TABLE cron_runs;
DROP TABLE cron_tasks;
CREATE INDEX cron_jobs_due_idx ON cron_jobs(run_at, id) WHERE status = 'pending';
CREATE INDEX cron_jobs_name_idx ON cron_jobs(name, id DESC);
`;

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: upSql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: downSql }); },
};
