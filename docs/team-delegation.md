# Team delegation

Team delegation isolates independent tool-heavy work in child-agent sessions while keeping progress visible to the parent.

## Runtime API

### `agent.delegate`

```ts
const member = await ctx.fns.agent.delegate({
  agent,
  title: "Research context compaction",
  tasks: [
    { id: "inspect", title: "Inspect implementations" },
    { id: "compare", title: "Compare approaches" },
    { id: "report", title: "Return recommendations" },
  ],
});
```

The function creates a lineage fork with an empty inherited transcript (`fork_offset = 0`), stores only delegation metadata in the child's scratchpad, creates the child's ordinary `session.plan`, appends a bounded task packet, and schedules the child through the durable worker queue. Parent tool traffic and scratchpad state are not copied into the child context.

### `agent.team`

```ts
const members = await ctx.fns.agent.team({ agent });
```

Returns direct, non-archived children with their existing plans, statuses and last summaries. It is a read-only projection over `agents.parent_id` and `scratchpad.plan`; there is no second task store.

### `agent.ask`

```ts
const followUp = await ctx.fns.agent.ask({
  agent,
  member: member.id,
  question: "Which implementation preserves tool results?",
});
```

Only direct children are addressable. The child resumes on its preserved transcript, so the parent can request details without importing the child transcript or repeating the investigation.

### `agent.steer`

`agent.steer` is the low-level child-to-parent notification primitive. It persists a `message_type="team_update"` message and a `team_update` UI event, refreshes both Meta panels, and schedules an idle parent immediately. Supported events are `task.completed`, `plan.completed`, `blocked`, and `failed`.

## Plans and Meta panel

Delegated children use the same `session.plan` and `session.done` functions as every other agent. The parent's right-side Meta panel renders each direct child and its task statuses in a **Team** section. Updating a child plan refreshes both the child and parent metadata topics.

When a delegated child completes a task, `session.done` emits one idempotent `task.completed` team update. After closing the final task, the child must call `agent.finishTask({ agent, summary, result })`; `result` is mandatory, is stored on that final closed task, and produces the single semantic `plan.completed` update. The child remains available for `agent.ask` follow-ups.

## Steering and wake-up

Team updates are stored as internal user-role messages with:

```ts
{
  message_type: "team_update",
  excluded_from_cursor: true
}
```

They are internal user-role messages excluded from the ordinary user cursor, not fake native tool results. `agent.steer` explicitly schedules the parent, so an update landing during a run is delivered in a subsequent pass without advancing or duplicating real user work. The UI renders them as compact team/tool-style cards.

If the parent is running, steering preserves `next_run_at` so the worker performs another pass after the current run. If the parent is idle, the same durable schedule wakes it immediately. Follow-up `agent.ask` atomically claims an idle child and rejects a concurrent request while the child is busy.

## Stop and retry

The parent Meta panel shows **Stop** for working/running members and **Retry** for blocked/failed members. The same lifecycle is available programmatically:

```ts
await ctx.fns.agent.stopMember({ agent, member: member.id });
await ctx.fns.agent.retryMember({ agent, member: member.id });
```

Stop aborts the active call, clears queued work, pauses the child plan and marks delegation `blocked`. Retry is allowed only for an idle blocked/failed direct child; it resumes the plan timer, appends a retry instruction and schedules the child through the durable worker queue.


## Storage model

No migration is required:

- parent/child relationship: `agents.parent_id`;
- child task list: `scratchpad.plan`;
- delegation status and summary: `scratchpad.delegation`;
- notifications: `messages.message_type = 'team_update'` and matching events;
- scheduling: `agents.next_run_at` and `run_state`.

Child transcripts remain durable and separate from the parent's model context.


## Archival and retention

Completed children remain `ready` for follow-up. A parent can hide one immediately with:

```ts
await ctx.fns.agent.archiveMember({ agent, member: member.id });
```

Restore it with `agent.unarchiveMember`. The Meta panel provides **Archive**, **Show archived**, and **Restore** controls. Archived children leave active agent and Team lists while their transcript, plan, result, and parent relationship remain durable.

`agent.archiveCompleted({ olderThanMs })` archives every inactive `ready` child older than the cutoff. The worker checks every ten seconds and uses the declared `agent.teamArchiveAfterMs` setting, which defaults to one minute; set it to `0` to disable automatic archival. Calling the function directly supports custom maintenance windows or immediate cleanup with `olderThanMs: 0`.
