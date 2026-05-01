# Architecture

## Direction

Realised model: **DB-first, single-process queue, htmx-driven long polling, minimal client JS, SSE only as a development side-channel (REPL).**

Core ideas (each backed by code, not aspirational):
- **The database is the source of truth.** Messages, events, queue state, and agent metadata all live in SQLite. Reads happen against the DB, not against in-memory mirrors.
- **The data plane is HTTP long polling.** The browser opens `GET /agent/:id/events.html?offset=N`, the server holds the connection up to ~25 s, returns rendered HTML for new events plus a self-replacing `#msg-tail` element. htmx fires the next poll automatically.
- **The signal plane is local in-process.** `session.appendEvent` calls `agent.wakeWaiters(ctx, agentId)`, which resolves any `waitForEvent` promise registered by long-poll handlers. No SSE wake-up bus is required for chat correctness.
- **One worker per process.** `agent.workerLoop` claims jobs from `agent_jobs` with an atomic SQL update, runs them serially, and sleeps until either the next debounce expires or `wakeWorker` fires.
- **Minimal client JS.** `src/agent/$script_chat.js` is ~30 lines: Enter-without-Shift submits, `htmx:afterSwap` scrolls #messages to the bottom, an "inherited context" banner. No polling, no event-bus listeners, no toasts, no overlays.

---

## Channels at a glance

| Concern              | Channel                                           | Driven by                           |
|----------------------|---------------------------------------------------|-------------------------------------|
| Initial render       | SSR HTML from `GET /agent/:id`                    | server-rendered                     |
| New events appear    | `GET /agent/:id/events.html?offset=N` (long poll) | htmx `#msg-tail` `hx-trigger="load"`|
| Status & exec time   | `GET /agent/:id/statusbar`                        | htmx `every 1s`                     |
| Sidebar refresh      | `GET <self URL>` with `x-hyper-fragment: sidebar` | htmx `every 10s`                    |
| User submits message | `POST /agent/:id?debounceSeconds=5`               | htmx `hx-post` on the form          |
| Delete a message     | `POST /agent/:id/messages/delete`                 | htmx `hx-confirm` + `hx-post`       |
| Stop / fork / archive| HTML form POST                                    | classic browser submit              |
| REPL UI control      | SSE on `/events`                                  | `events/client.js` (dev convenience)|

---

## Send flow

1. Browser submits the form. htmx posts `text=...` to `/agent/:id?debounceSeconds=5` with header `hx-request: true`.
2. Server validates, calls `session.appendUserMessage` (writes to `messages` + `events`, fires `wakeWaiters`).
3. Server calls `agent.enqueue` (writes a row to `agent_jobs`, fires `wakeWorker`).
4. Server replies `204 No Content`. Form is reset by `hx-on::after-request`.
5. The long-poll on `#msg-tail` (already pending) wakes via `wakeWaiters`, fetches new events from the DB, renders HTML, swaps in. Next tail starts another long poll.

## Receive flow

1. `agent.workerLoop` claims a queued job via:
   ```sql
   UPDATE agent_jobs
   SET status='running', run_key=?, started_at=?, finished_at=NULL, updated_at=?
   WHERE id = (
     SELECT id FROM agent_jobs
     WHERE status='queued' AND debounce_until <= ?
     ORDER BY debounce_until ASC, created_at ASC
     LIMIT 1
   )
   ```
2. Loop calls `agent.run`, which talks to the LLM and persists each event/message via `session.append*` helpers. Every persist call wakes any pending long pollers.
3. When the run finishes, the worker UPDATEs `agent_jobs.status` to `done|failed|aborted`. No in-memory queue or drain promise to manage.

## Recovery

- Browser refresh / new tab / lost network → next long-poll opens with the last-seen offset; server returns everything since.
- Server restart → `loadAll` rehydrates the in-memory cache from the DB, the worker re-checks `agent_jobs` (any `running` rows are conservatively still considered in-flight; we don't auto-reset them yet — see Remaining work).
- A signal lost mid-flight is harmless: long-poll's 25 s timeout falls back to a fresh request anyway.

---

## Offsets and cursors

`events.idx` and `messages.idx` are per-agent monotonic integers, assigned by `appendEvent` / `appendMessage` as `MAX(idx) + 1`. The browser tracks one cursor per agent, derived from the URL of the most recent `#msg-tail`:

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

## Role of in-memory agent state

`ctx.state.agent[id]` still exists, but is now a **write-through cache**, not authoritative for any user-visible state:

- Authoritative reads (transcript, events, status, queue) all go through `session.*` / `agent_jobs`.
- Cached fields used during execution: `abortController`, `currentJobId`, `isStreaming` (mirrored from `agent_jobs.status`), and `scratchpad` (a working area for `evalCode` between turns; persisted to `agents.scratchpad` JSON column on save).
- `agent.events` and `agent.messages` are still synced via `syncAgentState` for backward compatibility with `streamMock` and a few helpers, but they are no longer read by routes.

Removing `ctx.state.agent` entirely is **remaining work** — see below.

---

## Long-poll wake mechanism

It's an in-process condition variable: `Map<agentId, Set<resolver>>` on `ctx.state.eventWaiters`. Not SSE, not a socket — just promises in heap. `src/agent/waitForEvent.ts` + `src/agent/wakeWaiters.ts`.

### Four-step lifecycle

```
1. subscribe — long-poll handler caught up to DB
   src/agent/$route_$id_events.html_GET.ts:18-22
       const maxIdx = getMaxEventIdx(ctx, id);
       if (maxIdx + 1 <= offset) {
           await waitForEvent(ctx, id, 25_000, req.signal);  // ← (a)
           // re-read DB after wake
       }

   src/agent/waitForEvent.ts:
       const set = map.get(agentId) ?? new Set();
       set.add(onWake);              // resolver enters the Set    (a)
       setTimeout(onTimeout, 25_000);
       signal?.addEventListener('abort', onAbort, { once: true });
       // returns Promise that resolves on wake | timeout | abort

2. publish — any code persisting an event hits the same key
   src/session/appendEvent.ts:5-7
       INSERT INTO events ...
       UPDATE agents SET updated_at ...
       ctx.fns.agent.wakeWaiters(ctx, id);   // ← (b)

3. wake — every resolver fires once, set is cleared atomically
   src/agent/wakeWaiters.ts:
       const set = map.get(agentId);
       map.delete(agentId);
       for (const fn of set) fn();           //               (c)

4. consume — handler trusts the DB, not the wake
   re-call getMaxEventIdx, getEvents(fromIdx=offset),
   render HTML, return                      //               (d)
```

The wake doesn't carry data — it's just "go look in the DB". Even if a wake is delivered for an unrelated event (or duplicated), the worst case is one extra DB read. Correctness lives in step (d).

### Properties

| Property | How it's achieved |
|---|---|
| Per-agent isolation | `Map` key is `agentId`. Waking one agent doesn't touch others. |
| Multiple subscribers | `Set<resolver>` — many tabs / devices on the same agent wake together. |
| Idempotent wakes | `wakeWaiters` on empty set is no-op. Duplicate wakes are harmless. |
| Auto-cleanup | Resolver is removed in all three terminal paths (wake, timeout, abort). |
| Disconnected client | `req.signal` aborts → `onAbort` removes the resolver. Handler still finishes its work; the response goes to a closed socket and Bun drops it silently. |
| Liveness | `appendEvent` is on the critical path of every event write — there's no "forgot to notify" bug surface. |

### Why this is a signal plane, not a data plane

The wake carries zero payload. It's a hint: "something changed, re-read the DB if you care." That's the principle in `## Direction`: signal plane is in-memory and best-effort; data plane is HTTP+SQL and authoritative. A lost or stale wake at worst delays a long-poll until its 25 s timeout, after which it re-fetches anyway.

### Worker uses the same pattern

`src/agent/wakeWorker.ts` + `src/agent/workerLoop.ts` use a process-wide `Set<() => void>` at `ctx.state.workerWakeWaiters`. `src/agent/enqueue.ts` calls `wakeWorker` right after `INSERT INTO agent_jobs`. The worker's `waitForWork` is the same condvar pattern but unkeyed (single waiter loop).

So the system has exactly two condvars:
- `eventWaiters` (per-agent) — wakes long-poll handlers.
- `workerWakeWaiters` (process-wide) — wakes the single worker loop.

Both trigger inside the write functions (`appendEvent` / `enqueue`) immediately after the SQLite commit.

### Multi-process / multi-instance limitation

Both condvars live in `ctx.state` — heap of one Bun process. They don't cross process boundaries. If the app is later scaled to multiple Bun instances against a shared DB, the wake bus has to move out of the heap. Practical replacements:

- **Postgres**: `LISTEN agent_event` / `NOTIFY agent_event '<agentId>'` from `appendEvent`'s trigger. Each instance keeps a single `LISTEN` connection and dispatches into its local `eventWaiters` map.
- **Redis**: `PUBLISH events.<agentId> ""` and a per-instance subscriber.
- **Polling fallback**: handler polls `getMaxEventIdx` every 1–2 s; gives up the latency edge but keeps correctness.

This is documented in *Remaining work* below — current code is single-process by design.

### Bun.serve idleTimeout caveat

`Bun.serve` defaults to a 10-second `idleTimeout`. A connection is "idle" while the handler is awaiting and writing nothing — exactly what a long-poll does. Without intervention Bun silently closes the socket at 10 s; the curl-side error is `52 "got nothing"` even though the server-side log records a successful 200.

Two ways to fix:

1. Global: `Bun.serve({ idleTimeout: 60 })` (max 255, `0` disables). Heavy-handed — affects every endpoint.
2. **Per-request (used here)**: `server.timeout(req, seconds)` from inside the handler. Adjusts only that connection.

`src/http/$start.ts` keeps the global default (10 s, normal protection). `src/agent/$route_$id_events.html_GET.ts` calls `ctx.state.server.server.timeout(req, ~30)` once it accepts the request, so just the long-poll request gets the headroom. Reference: [Bun docs — Server.timeout](https://bun.com/reference/bun/Server/timeout) and [oven-sh/bun#13712](https://github.com/oven-sh/bun/issues/13712).

---

## Mock LLM, no live network in tests

Per `CLAUDE.md`: every test uses `model: 'mock:*'` which routes through `src/llm/streamMock.ts`. Live integration tests for `streamOpenAI` are gated behind `LIVE_LLM=1` and are **off by default**. This makes `bun test` deterministic and offline.

`agent.scratchpad.mockLLM = { echoUser, userToolCode, afterToolText }` controls mock behavior in tests.

---

## Sidebar scoping

The sidebar polls itself every 10 seconds: `<aside hx-get="${selfUrl}" hx-headers='{"x-hyper-fragment":"sidebar"}'>`. The server's `$layout.ts` returns just the `<aside>` fragment when that header is present. `selfUrl` is threaded from the dispatcher (`http/$start.ts` → `toResponse(ctx, raw, req)` → `layout(ctx, opts, req)`).

---

## Remaining work (intentional gaps)

These were considered out of scope for the current refactor and are documented for future passes:

1. **`ctx.state.agent[*]` purge.** Routes still go through a write-through cache. After a server restart `session.loadAll` rehydrates it, so behaviour is correct, but the cache could diverge in a long-running multi-tab scenario. To fix: replace every `(ctx.state as any).agent?.[id]` with a fresh `session.load(ctx, id)` and let routes pay one DB read per request.
2. **`scratchpad` persistence.** Currently saved to `agents.scratchpad` only on `session.save`. If the worker crashes mid-run, in-flight scratchpad mutations are lost. To fix: `session.updateScratchpad` is already implemented — call it on every mutation rather than at save points only.
3. **In-flight `running` jobs after restart.** `loadAll` doesn't reset `agent_jobs.status='running'` to `queued`. Currently relies on the worker not picking them up (`debounce_until <= now AND status = 'queued'`), so they sit forever. To fix: a startup sweep that flips orphaned `running` rows to `failed` or `queued` based on age.
4. **Multiuser / authz.** No request authorization yet. Endpoints are open. Long polls are not scoped to a user.
5. **Live-thinking overlay.** Removed in this refactor; no real-time per-token streaming UI remains. Status bar shows `running · 12.3s` but final assistant content only appears after the LLM finishes. If reintroduced, suggested approach: persist `thinking` events at a lower cadence (every N tokens) and let long-poll deliver them.
6. **`hyper-events` SSE bus.** Still alive at `/events` and `/events/client.js` for the REPL `ui.eval` / `ui.notify` developer affordance. Not used by the chat surface. Can be deleted if REPL UI control is no longer needed.

---

## Why these choices

### Why long poll over WebSocket

Every fetch is an authorized HTTP request. Reconnect is a normal `fetch`, not a stateful WS handshake. Replay is just `?offset=N`. A timeout falls back to another request — no special handling. The 25 s hold matches HTTP/1.1 keep-alive expectations and friendly proxies. WebSocket buys lower latency but at the cost of every above invariant.

### Why a single worker, not per-agent goroutines

Sqlite serializes writes anyway. Running multiple workers means more coordination (exclusive UPDATE claims, run-key checks) for no throughput gain on a single SQLite file. One worker keeps mental model and stack traces simple; we can grow to N workers later if a different DB engine arrives.

### Why htmx and not React/Datastar/etc

The DOM is already the right kind of stateful machine: append-only event log + tiny ephemeral form. htmx's `outerHTML` swap of `#msg-tail` is a one-line description of "infinite scroll backwards in time" — adding a frontend framework here is pure cost. Datastar's signal model is closer to React; htmx's "HTML over the wire" is closer to the actual DB-first transport we wanted.

### Why no `agent.thinking.delta` SSE channel

The earlier doc noted the tension: live tokens are *data*, but the rule said SSE is *signal-only*. We chose the simpler invariant — every byte the user sees came from a long-poll fetch from the DB — and dropped the live overlay. The status bar's `running · Xs` counter (1 s htmx poll) gives users the "something's happening" signal without violating the data-plane rule.
