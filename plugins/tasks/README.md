# tasks

A minimal Hyper Code plugin that gives every task a dedicated agent chat.

## User interface

Open `/tasks` (or use the command palette) to see an issue-style list. The UI supports:

- open and closed task views;
- creating a task from its description;
- shared or isolated working directories;
- starting one attached agent chat;
- opening the chat from the task;
- manually moving a task between `todo`, `running`, and `done`.

The first non-empty line of the description is displayed as the issue title. Remaining lines are the issue body.

## Workspace modes

| Mode | Agent directory |
| --- | --- |
| `default` | `~/.hyper/tasks` |
| `isolated` | `~/.hyper/tasks/<task-id>` |

Directories are created when the agent starts. A task keeps its resolved path in `workspace_dir`.

## Data model

The plugin owns PostgreSQL schema `tasks` and table `tasks.task`:

- `id uuid`
- `description text`
- `status text` — `todo`, `running`, or `done`
- `agent_id text` — optional reference to the attached Hyper agent/chat
- `workspace_mode text` — `default` or `isolated`
- `workspace_dir text` — resolved directory after start
- `created_at bigint`
- `updated_at bigint`

Only one agent can be attached to a task. Deleting an agent clears the reference without deleting the task.

## Procedural API

```ts
await ctx.fns.tasks.create({
  description: "Investigate the failing build\nFind the cause and prepare a fix.",
  workspaceMode: "isolated",
});

await ctx.fns.tasks.list({});
await ctx.fns.tasks.list({ status: "todo" });
await ctx.fns.tasks.get({ id });
await ctx.fns.tasks.start({ id, model });
await ctx.fns.tasks.setStatus({ id, status: "done" });
```

`tasks.start` creates the agent, attaches it transactionally when the task has no agent, appends the description as the first user message, and schedules the agent through the normal inline agent queue.

## Completion semantics

The plugin does **not** equate the end of an LLM turn with successful completion. A user must explicitly set `done` after reviewing the attached chat. This avoids marking blocked, interrupted, or clarification-seeking work as complete.

## Installation

The plugin container is `plugins/tasks` and is mounted by adding it to `workspace.json`:

```json
{
  "modules": {
    "tasks": {}
  }
}
```

Its runtime namespace is `ctx.fns.tasks`, and its database relation is `tasks.task`.
