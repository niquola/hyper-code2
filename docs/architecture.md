# Architecture

## Direction

**Simplicity first. DB-first. htmx long-poll. Single in-process worker.**

Everything durable lives in SQLite. Everything visible to the user comes from a normal HTTP fetch. There is no queue table — debounce and run-state are columns on `agents`. Realtime is one in-process condvar; it carries no data, only "go look in the DB".

```mermaid
graph TB
    subgraph Truth[SQLite — source of truth]
        AGENTS[(agents<br/>id · run_state · next_run_at<br/>last_processed_msg_idx · run_started_at)]
        MSGS[(messages<br/>append-only · per-agent idx)]
        EVENTS[(events<br/>append-only · per-agent idx)]
        KV[(kv<br/>agent:idCounter for nextId)]
    end

    subgraph DataPlane[Data plane — HTTP]
        POST["POST /agent/:id"]
        LP["GET /agent/:id/events.html<br/>(long-poll · 25s)"]
        SB["GET /agent/:id/statusbar<br/>(every 1s)"]
        SF["GET / with x-hyper-fragment: sidebar<br/>(every 10s)"]
    end

    subgraph SignalPlane[Signal plane — in-process condvar]
        WW[wakeWaiters · per-agent]
        WS[wakeWorker · process-wide]
    end

    POST  --> MSGS
    POST  --> AGENTS
    POST  --> WS
    LP    --> EVENTS
    LP    -.waits on.- WW
    SB    --> AGENTS
    SF    --> AGENTS
    SF    --> MSGS

    EVENTS -.appendEvent fires.- WW
    AGENTS -.next_run_at fires.- WS
```

---

## Principles

1. **The DB is the source of truth.** Messages, events, run-state, scheduling — all in SQLite. Memory is only an execution cache.
2. **HTTP is the data plane.** Browser fetches all visible state through normal HTTP requests. Long-polling is just `GET` that holds the connection.
3. **Wakeups are signals, not data.** `wakeWaiters` carries no payload — handlers re-read the DB after they wake. A lost or duplicate wake at worst delays a long-poll until its 25 s timeout, after which it re-fetches anyway.
4. **One worker. No queue table.** Run scheduling is two columns on `agents`: `next_run_at` (when to fire) and `run_state` (`'idle' | 'running'`). The single in-process `workerLoop` drains them.
5. **Minimal client JS.** ~30 lines: Enter-key handler + scroll-on-swap. Everything else is htmx attributes.

---

## Channels at a glance

| Concern              | Channel                                           | Driven by                             |
|----------------------|---------------------------------------------------|---------------------------------------|
| Initial render       | SSR HTML from `GET /agent/:id`                    | server-rendered                       |
| New events appear    | `GET /agent/:id/events.html?offset=N` (long poll) | htmx `#msg-tail` `hx-trigger="load"`  |
| Status & exec time   | `GET /agent/:id/statusbar`                        | htmx `every 1s`                       |
| Sidebar refresh      | `GET <self URL>` with `x-hyper-fragment: sidebar` | htmx `every 10s`                      |
| User submits message | `POST /agent/:id?debounceSeconds=5`               | htmx `hx-post` on the form            |
| Delete a message     | `POST /agent/:id/messages/delete`                 | htmx `hx-confirm` + `hx-post`         |
| Stop / fork / archive| HTML form POST                                    | classic browser submit                |
| REPL UI control      | SSE on `/events`                                  | `events/client.js` (dev convenience)  |

---

## Send flow

```mermaid
sequenceDiagram
    participant B as Browser (htmx form)
    participant S as Server
    participant DB as SQLite
    participant W as workerLoop
    participant L as LLM

    B->>S: POST /agent/:id (text=hi)
    S->>DB: appendUserMessage → messages
    S->>DB: UPDATE agents SET next_run_at = MAX(curr, now+5s)
    S->>W: wakeWorker
    S-->>B: 204 No Content

    Note over W: claim via<br/>UPDATE agents SET run_state='running'<br/>WHERE id IN (SELECT … WHERE next_run_at <= now LIMIT 1)<br/>RETURNING id

    W->>DB: snapshot userFrontier = MAX(messages.idx) WHERE role='user'
    W->>L: stream(transcript)
    L-->>W: tokens / tool_calls
    W->>DB: appendAssistantMessage / appendEvent / …
    DB-->>+S: wakeWaiters(agentId)  (events appended)
    Note over S: any pending #msg-tail<br/>long-poll resolves and<br/>re-reads getEvents(fromIdx=N)

    W->>DB: UPDATE agents SET run_state='idle',<br/>last_processed_msg_idx=userFrontier (success only),<br/>next_run_at = (new user msgs? now+5s : NULL)
    Note over W,DB: aborted/failed → cursor unchanged,<br/>next_run_at = NULL (no auto-retry)
```

POST is **one message INSERT + one agent UPDATE**. No queue row. No payload duplicate of the message text — the message itself is the input.

If two POSTs land within the debounce window, both rows are appended to `messages`, and `next_run_at = MAX(...)` keeps the run scheduled for the latest one. When the worker fires, both messages go to the LLM in one transcript — natural merge.

## Receive flow

The browser opens `GET /agent/:id/events.html?offset=N` (htmx `hx-trigger="load"` on the tail div). The server checks `getMaxEventIdx`. If new events exist → render them + a fresh `<div id="msg-tail">` and return. If not → `await waitForEvent(ctx, id, 25_000, req.signal)`. While waiting, any `appendEvent` for this agent fires `wakeWaiters(agentId)` and the handler resumes, re-reads the DB, and returns the delta.

After the swap, htmx auto-fires the next poll because the new `<div id="msg-tail">` again has `hx-trigger="load"`.

---

## Recovery

| Event                       | What happens                                                                  |
|-----------------------------|-------------------------------------------------------------------------------|
| Browser refresh             | SSR renders all messages; long-poll opens at the new `last idx + 1`.          |
| Lost network                | Long-poll reconnects; comes in with the last cursor; gets the delta.          |
| Server restart              | `loadAll` rehydrates agents; pending `run_state='running'` rows reset on next worker pass (see Remaining work). |
| Wake signal lost            | Long-poll's 25 s timeout falls back to a fresh `getEvents` re-read. Harmless. |

---

## Run-state on the agents row

```sql
agents.next_run_at            INTEGER       -- ms epoch when next run should fire (NULL = nothing scheduled)
agents.last_processed_msg_idx INTEGER       -- cursor over USER messages; advances only on successful run
agents.run_state              TEXT          -- 'idle' | 'running'
agents.run_started_at         INTEGER       -- for status-bar elapsed counter
agents.last_error             TEXT          -- last error text (audit-lite)
```

Rules:

- `POST` does `UPDATE agents SET next_run_at = MAX(COALESCE(next_run_at, 0), now + N)`. The `MAX` prevents an earlier message from rolling back an already-pushed-out run.
- The worker's atomic claim is `UPDATE agents SET run_state='running' WHERE id IN (SELECT id FROM agents WHERE run_state='idle' AND next_run_at <= now ORDER BY next_run_at ASC LIMIT 1) RETURNING id`. SQLite's `RETURNING` makes this one-statement-atomic — no two workers can claim the same agent.
- **Cursor scope is `role='user'` only.** Both the pre-run frontier snapshot and the post-run "still pending" check use `WHERE role='user'`. Assistant + tool messages emitted by `run()` itself are not pending work — without this, every successful turn would look like fresh input and the worker would re-run on the same conversation forever.
- `last_processed_msg_idx` only advances on **success**. Aborted or failed runs leave the cursor where it was. They also do **not** auto-reschedule (`next_run_at = NULL` on the failure path) — the user's next POST decides whether to retry. Otherwise a permanently broken LLM call would burn the worker in a tight loop.
- If new **user** messages land while a run is in progress, the worker's `finally` block detects `MAX(idx) WHERE role='user' > cursor` and sets `next_run_at = now + 5s` again before returning to `idle`. Successful run → auto-rescheduling for the new input. Failed run → no rescheduling.

---

## Long-poll wake mechanism

It's an in-process condition variable: `Map<agentId, Set<resolver>>` on `ctx.state.eventWaiters`. Not SSE, not a socket — just promises in heap.

```mermaid
sequenceDiagram
    participant H as Long-poll handler
    participant M as ctx.state.eventWaiters
    participant W as session.appendEvent

    H->>M: register resolver (timeout 25s)
    Note over H: handler awaits Promise

    W->>W: INSERT INTO events
    W->>M: wakeWaiters(agentId)
    M-->>H: resolve()
    Note over H: re-read DB,<br/>render delta + new tail
    H->>H: return Response
```

### Properties

| Property              | How                                                                                      |
|-----------------------|------------------------------------------------------------------------------------------|
| Per-agent isolation   | `Map` key is `agentId`. Waking one agent doesn't touch others.                           |
| Multiple subscribers  | `Set<resolver>` — many tabs / devices on the same agent wake together.                   |
| Idempotent wakes      | `wakeWaiters` on empty set is no-op. Duplicate wakes are harmless.                       |
| Auto-cleanup          | Resolver is removed in all three terminal paths (wake, timeout, abort).                  |
| Disconnected client   | `req.signal` aborts → `onAbort` removes the resolver. Bun drops the response silently.   |
| Liveness              | `appendEvent` is on the critical path of every event write — no "forgot to notify" bug.  |

The wake carries **zero payload**. It's a hint: "something changed, re-read the DB if you care." Correctness lives in the post-wake DB read, not the signal.

### Worker uses the same pattern

`wakeWorker` + `workerLoop`'s `waitForWork` use a process-wide `Set<() => void>` at `ctx.state.workerWakeWaiters`. POST calls `wakeWorker` after bumping `next_run_at`. Worker's `waitForWork` is the same condvar pattern but unkeyed (single waiter loop).

So the system has exactly **two condvars**:
- `eventWaiters` (per-agent) — wakes long-poll handlers.
- `workerWakeWaiters` (process-wide) — wakes the single worker loop.

### Bun.serve idleTimeout caveat

`Bun.serve` defaults to 10 s `idleTimeout`. A long-poll handler that's awaiting and writing nothing **is** "idle" by Bun's definition — at 10 s the socket is silently closed mid-response (server-side log records 200, curl gets exit 52 "got nothing").

Per-request fix: `server.timeout(req, 30)` from inside the handler. `src/agent/$route_$id_events.html_GET.ts` calls `ctx.state.server.server.timeout(req, ~30)` once it accepts the request, leaving the global default at 10 s for normal endpoints. Reference: [Bun docs — Server.timeout](https://bun.com/reference/bun/Server/timeout) and [oven-sh/bun#13712](https://github.com/oven-sh/bun/issues/13712).

---

## Offsets and cursors

`events.idx` and `messages.idx` are per-agent monotonic integers, assigned by `appendEvent` / `appendMessage` as `MAX(idx) + 1`. The browser tracks one cursor per page, derived from the URL of the most recent `#msg-tail`:

```html
<div id="msg-tail"
     hx-get="/agent/:id/events.html?offset=N"
     hx-trigger="load"
     hx-swap="outerHTML">
</div>
```

The server response contains the new events HTML followed by a fresh `#msg-tail` with `offset = nextIdx`. After the swap, htmx auto-fires the next request because the new tail also has `hx-trigger="load"`.

`session.getMaxEventIdx(ctx, agentId)` returns the cursor head; `session.getEvents(ctx, agentId, { fromIdx, limit })` returns the slice.

---

## Sequential agent IDs

`ctx.fns.agent.nextId` returns `a, b, …, z, aa, ab, …` (base-26). Counter persisted in `kv(key='agent:idCounter')`. `start.ts` calls `nextId(ctx)` — no UUIDs, no `agent_<hex>` prefix.

---

## Settings — DB-backed key-value with scope

`src/settings/` is a generic key-value store keyed by `(module, scope_type, scope_id, key)`. Value is JSON-encoded; an `is_secret` flag is recorded but currently advisory only.

```sql
CREATE TABLE settings (
    module      TEXT NOT NULL,
    scope_type  TEXT NOT NULL,
    scope_id    TEXT NOT NULL DEFAULT '',
    key         TEXT NOT NULL,
    value       TEXT NOT NULL,
    is_secret   INTEGER NOT NULL DEFAULT 0,
    updated_at  INTEGER NOT NULL,
    PRIMARY KEY (module, scope_type, scope_id, key)
);
CREATE INDEX idx_settings_scope ON settings(scope_type, scope_id, module);
```

API: `ctx.fns.settings.{get, set, remove, list, getNumber, getString}`. `getNumber`/`getString` accept `fallback` — `getNumber` also rejects non-finite values (`NaN`, `Infinity`).

### Scopes shipped

| Module     | Scope          | Key         | Used by                                  |
|------------|----------------|-------------|------------------------------------------|
| `llm`      | `global`       | `defaultModel` | `ui/createAgent.ts` — default agent model when `opts.model` is absent |
| `provider` | `provider:<name>` | `baseUrl`   | `llm/resolveEndpoint.ts` — overrides hardcoded base URL  |
| `provider` | `provider:<name>` | `apiKey`    | `llm/resolveEndpoint.ts` — overrides env-var key         |
| `ui`       | `agent:<id>`   | `debounceMs` | `agent/$route_$id_POST.ts` — per-agent default debounce |

### Priority

Each consumer follows the same order:
1. **Explicit caller input** (e.g. POST `?debounceSeconds=...`, `opts.model`) — wins always.
2. **Settings table** — for the relevant scope.
3. **Env var / hard-coded default** — last resort.

So `settings.set(ctx, { module: 'ui', scopeType: 'agent', scopeId: 'a', key: 'debounceMs', value: 1000 })` makes agent `a` debounce at 1s without redeploying.

---

## Mock LLM, no live network in tests

Per `CLAUDE.md`: every test uses `model: 'mock:*'` which routes through `src/llm/streamMock.ts`. Live integration tests for `streamOpenAI` are gated behind `LIVE_LLM=1` and **off by default**. `bun test` is deterministic and offline.

`agent.scratchpad.mockLLM = { echoUser, userToolCode, afterToolText }` controls mock behavior in tests.

The shared test fixture is `src/_testCtx.entry.ts` — `mkTestCtx()` returns a fully-wired `ctx` with `:memory:` DB + migrations + all common `ctx.fns.*` already populated. The `.entry.ts` suffix is skipped by the project scanner so the helper is **not** auto-registered as `ctx.fns.testCtx`.

---

## Sidebar scoping

The sidebar polls itself every 10 seconds: `<aside hx-get="${selfUrl}" hx-headers='{"x-hyper-fragment":"sidebar"}'>`. The server's `$layout.ts` returns just the `<aside>` fragment when that header is present. `selfUrl` is threaded from the dispatcher (`http/$start.ts` → `toResponse(ctx, raw, req)` → `layout(ctx, opts, req)`).

---

## Remaining work (intentional gaps)

These are deliberate non-goals for the current refactor:

1. **`ctx.state.agent[*]` purge.** Routes still go through a write-through cache. After a server restart `session.loadAll` rehydrates it, so behaviour is correct, but the cache could diverge in long-running multi-tab scenarios. Fix: replace every `(ctx.state as any).agent?.[id]` with a fresh `session.load(ctx, id)`.
2. **Per-mutation scratchpad persist.** Currently `session.save` writes the whole agent (incl. scratchpad). Mid-run scratchpad mutations are lost on crash. Fix: call `session.updateScratchpad` on each change.
3. **`run_state='running'` on restart.** `loadAll` doesn't reset rows that were in-flight when the previous process died. They sit forever. Fix: a startup sweep that flips orphans to `idle` (or `failed` based on `run_started_at` age).
4. **Multiuser / authz.** No request authorization. Endpoints are open. Long polls are not scoped to a user.
5. **Live thinking-overlay.** Removed in this refactor — only the final assistant message appears (after the LLM finishes). Status bar shows `running · 12.3s` so users see something is happening. To reintroduce: persist `thinking` events at low cadence and let long-poll deliver them.
6. **Per-run audit ledger.** With `agent_jobs` removed, only `last_error` survives across runs. To analyse "how long did the last 50 runs take, how many aborted, how many tool calls per run", we'd reintroduce a thin `runs(id, agent_id, started_at, finished_at, status, …)` table — written **only at run boundaries**, not per message.

---

## Why these choices

### Why no queue table?

A chat agent has exactly one input — the user's messages. A separate `agent_jobs` table was duplicating the input log and adding bookkeeping (`payload_json` carrying the same text already in `messages`, `debounce_until` per row when it logically belongs to the agent). One row in `messages` + two columns on `agents` carry the same information with less ceremony. When we later need genuine background workloads (`compact`, `delegate`, `cron`), we can introduce a typed `runs` or `jobs` table — for **runs**, not per-message scheduling.

### Why long poll over WebSocket

Every fetch is an authorized HTTP request. Reconnect is just another `fetch`, not a stateful WS handshake. Replay is `?offset=N`. A timeout falls back to another request — no special handling. WebSocket buys lower latency at the cost of every above invariant.

### Why a single worker, not per-agent goroutines

SQLite serializes writes anyway. Multiple workers means more coordination (exclusive UPDATE claims, run-key checks) for no throughput gain on one SQLite file. One worker keeps the mental model and stack traces simple; we can grow to N if a different DB engine arrives.

### Why htmx and not React/Datastar/etc

The DOM is already the right kind of stateful machine: append-only event log + tiny ephemeral form. htmx's `outerHTML` swap of `#msg-tail` is a one-line description of "infinite scroll backwards in time". Adding a frontend framework here is pure cost.

### Why no `agent.thinking.delta` SSE channel

The earlier doc noted the tension: live tokens are *data*, but the rule said SSE is *signal-only*. We chose the simpler invariant — every byte the user sees came from a long-poll fetch from the DB — and dropped the live overlay. The status bar's `running · Xs` counter (1 s htmx poll) gives the "something's happening" signal without violating the data-plane rule.
