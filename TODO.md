# TODO

## Simplify agent message processing

Replace per-message `agent_jobs` queueing with a simpler DB-first worker model based on `messages` + agent progress state.

### Idea

- Treat `messages` as the only append-only input log.
- Let a worker scan for agents with new `role = 'user'` messages.
- Store progress on the `agents` row instead of creating one `agent_jobs` row per message.

### Proposed state in `agents`

Add fields along these lines:
- `processed_idx` or `last_handled_user_idx`
- `is_running`
- `run_started_at`
- `last_error`
- optional debounce marker such as `debounce_until` or derive debounce from latest message `ts`

### Worker model

- Worker periodically or reactively scans `messages` for user messages with `idx > processed_idx`.
- Use `messages.ts` / latest user-message timestamp to implement debounce.
- When debounce passes and the agent is idle, run the agent once.
- After a successful pass, advance `processed_idx` on `agents`.
- If new messages arrive during a run, leave them pending for the next pass.

### Why this may be better

- One write path: write user input to `messages`.
- Less overhead than one `agent_jobs` row per message.
- Simpler mental model for chat-only processing.
- Keeps transcript as the real source of incoming work.

### Tradeoffs

- Less suitable if we want a general-purpose background job system.
- Harder to represent rich execution history per run unless we add separate run/event tracking.
- Need clear semantics for debounce and for messages arriving during an active run.

### Migration direction

1. Review all current uses of `agent_jobs`.
2. Decide the minimal processing fields to store on `agents`.
3. Prototype worker logic that derives pending work from `messages`.
4. Preserve stop/error/status behavior.
5. Remove `agent_jobs` only if no other non-chat workloads need it.
