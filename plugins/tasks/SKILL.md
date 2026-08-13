# Tasks

Use this plugin to create and run durable tasks with one attached agent chat per task. Data is stored in PostgreSQL relation `tasks.task`; the UI is available at `/tasks`.

## Functions

- `ctx.fns.tasks.create({ description, workspaceMode? })`
- `ctx.fns.tasks.get({ id })`
- `ctx.fns.tasks.list({ status? })`
- `ctx.fns.tasks.start({ id, model? })`
- `ctx.fns.tasks.setStatus({ id, status })`

Statuses are `todo`, `running`, and `done`. Workspace mode is `default` or `isolated`:

- `default` uses `~/.hyper/tasks`;
- `isolated` uses `~/.hyper/tasks/<task-id>`.

Directories are created when the attached agent starts. `tasks.start` sends the task description as the first message and schedules the agent through Hyper's normal queue.

A task is not marked `done` merely because an agent turn ended. Review the attached chat and set the status explicitly.

See `README.md` for the schema, UI, installation, and API examples.
