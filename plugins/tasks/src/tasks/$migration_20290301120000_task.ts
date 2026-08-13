const upSql = `
CREATE SCHEMA IF NOT EXISTS tasks;

CREATE TABLE IF NOT EXISTS tasks.task (
    id uuid PRIMARY KEY,
    description text NOT NULL,
    status text NOT NULL DEFAULT 'todo',
    agent_id text REFERENCES public.agents(id) ON DELETE SET NULL,
    workspace_mode text NOT NULL DEFAULT 'default',
    workspace_dir text,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL,
    CONSTRAINT task_status_check CHECK (status IN ('todo', 'running', 'done')),
    CONSTRAINT task_workspace_mode_check CHECK (workspace_mode IN ('default', 'isolated'))
);

CREATE UNIQUE INDEX IF NOT EXISTS task_agent_id_unique
    ON tasks.task(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS task_updated_at_idx ON tasks.task(updated_at DESC);
`;

export default {
    up: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: upSql }); },
    down: async (ctx: Context) => { await ctx.fns.procs.db.exec({ sql: "DROP SCHEMA IF EXISTS tasks CASCADE" }); },
};
