---
description: hyper-code2 — procedural Bun codebase with a self-extending agent at `/`.
alwaysApply: true
---

# hyper-code2

Procedural TypeScript on Bun. Functions + data + REPL. Inspired by [proc-ts](../proc-ts). One tiny HTTP server, one agent at `/` driven by `evalCode` only, all code hot-reloadable.

## Runtime environment

- **Bun, not Node.js.** Use `bun`, `bun test`, `bun install`, `bunx`, `bun build`. `.env` loads automatically.
- Prefer Bun built-ins over npm packages:
  - `Bun.serve()`, `Bun.file()`, `Bun.write()`, `Bun.$` shell, `Bun.Glob`, `Bun.spawn`, `Bun.hash`, `Bun.CryptoHasher`, `Bun.password`, `Bun.TOML.parse`, `Bun.gzipSync`, `Bun.randomUUIDv7`, `Bun.inspect`, `Bun.markdown.html`.
  - `bun:sqlite`, `Bun.sql` (Postgres), `Bun.redis`, `Bun.s3()`.
- Tests: `bun:test` — Jest-compatible. Filename must match `*.test.ts` for auto-discovery. `.env.test` loads automatically when `NODE_ENV=test` (bun test sets this).

## Architecture: procedural ctx.fns

**One function per file. Folder = namespace.** Files are loaded into `ctx.fns.<module>.<fn>`.

```
src/
  $main.ts                 entry: loadFns → genTypes → loadRoutes → server.start
  $type_Context.ts         global `Context` type
  ctx_ns.d.ts              AUTO-GEN — FnsRegistry, RootFns, types.*
  genTypes.ts              ctx.genTypes — rescans src/ + .hyper/, writes ctx_ns.d.ts
  $route_GET.ts            GET /  (single-page chat UI)

  llm/                     ctx.fns.llm.* — LLM layer
    resolveEndpoint.ts     (ctx, "provider:modelId") → {url, apiKey, modelId, provider}
    stream.ts              stateless /v1/chat/completions with tool_calls + streaming (OpenAI-compat)

  agent/                   ctx.fns.agent.* — the agent runtime
    SYSTEM_PROMPT.md       editable prompt (authoritative)
    $type_Agent.ts
    start / stream / run / compact / clear / stop / systemPrompt
    renderMarkdown / highlight
    $route_*.ts            HTTP: POST/GET/DELETE /agent, POST /agent/stop

  repl/                    ctx.fns.repl.*
    eval.ts                new Function("ctx", ...) + extra bindings
    load.ts                hot-reload a fn or folder from src/ or .hyper/
    $route__POST.ts        POST /repl — executes arbitrary JS

  server/                  ctx.fns.server.*
    $start.ts              Bun.serve with dynamic dispatch via server.match
    match.ts               path matcher (supports :params)

  http/                    ctx.fns.http.*
    loadRoutes.ts          scans $route_*.ts files into ctx.routes

  db/                      ctx.fns.db.* — shared SQLite infrastructure
    connect.ts             opens db (WAL), stores on ctx.state.db
    migrate.ts             scans **/$migrate_<ts>_<name>.up.sql, applies pending in ts-order, tracks in _migrations
    exec.ts                exec(ctx, {sql, params?}) → {changes, lastInsertRowid}
    select.ts              select<T>(ctx, {sql, params?}) → T[]
    insert.ts              insert(ctx, {table, row}) → {changes, lastInsertRowid}

  session/                 ctx.fns.session.* — per-agent persistence (uses db/)
    $migrate_20260418000000_init.up.sql  — baseline schema (agents, messages, events)
    save / load / loadAll / list / search / delete
```

## Conventions

- `export default async function (ctx: Context, opts: {...})` — **anonymous**, no function name. Every fn takes `ctx` first, then a single options-object.
- **Universal calling convention**: `ctx.fns.<ns>.<fn>(ctx, { ...opts })`. Single rule, no per-fn argument-order recall. The agent reads the destructuring pattern via `fn.toString()` rather than guessing positional arguments.
  - Single-arg fns still take an opts wrapper: `files.read(ctx, { path })`, not `files.read(ctx, path)`.
  - Zero-arg fns are `(ctx)` only (no opts wrapper): `session.list(ctx)`, `agent.workerLoop(ctx)`, `llm.listModels(ctx)`.
  - Optional fields go inside opts as `opts.x ?? default`.
- Cross-file calls go through `ctx.fns.<ns>.<fn>(ctx, { ... })`. **No cross-imports between project files.** Only `import` from `bun`, `node:*`, or third-party.
- Types are global via auto-generated `ctx_ns.d.ts`:
  - `src/<mod>/$type_<Name>.ts` → `types.<mod>.<Name>` globally.
  - `src/$type_Context.ts` → global `Context` (composed with `FnsRegistry` + `RootFns`).
  - Never `import type { Agent }` — use `types.agent.Agent` directly.
- Special filenames (`$` prefix stripped when registering in `ctx.fns`):
  - `$main.ts` — entry point, NOT loaded into ctx.fns.
  - `$test.ts` — deprecated; use `*.test.ts` for bun test discovery.
  - `$route_<path>_<METHOD>.ts` — HTTP route. `_` in path = `/`, `$foo` = `:foo` param. See `src/http/loadRoutes.ts`.
  - `$type_<Name>.ts` — type declaration, compile-time only.
  - Other `$<name>.ts` (e.g. `$start.ts`) — regular function, loaded as `ctx.fns.<mod>.<name>`.
- Test files named `*.test.ts`. `bun test` picks them up automatically.

## Routes

Dynamic dispatch — mutations to `ctx.routes` are effective on the next request without `server.reload()`. See `src/server/$start.ts` and `src/server/match.ts`.

Current live routes:
- `GET /` — chat UI (Tailwind via CDN)
- `POST /agent` — send a message (non-blocking, queues run in background)
- `GET /agent?offset=N` — poll for new events (`isStreaming`, `nextOffset`)
- `DELETE /agent` — reset agent
- `POST /agent/stop` — abort current run
- `POST /repl` — evaluate arbitrary JS (used by `script/repl.ts`)

## REPL workflow

Long-running server in tmux session `hyper`. Everything iterated without restart.

```bash
# start
tmux new-session -d -s hyper 'bun src/$main.ts'

# evaluate code
bun script/repl.ts '1 + 1'
bun script/repl.ts 'return Object.keys(ctx.fns)'
bun script/repl.ts -f /tmp/play.js          # from file
echo '...' | bun script/repl.ts             # from stdin

# hot-reload
bun script/repl.ts 'await ctx.fns.repl.load(ctx, { name: "agent" })'         # whole folder
bun script/repl.ts 'await ctx.fns.repl.load(ctx, { name: "agent.run" })'     # single fn
bun script/repl.ts 'return await ctx.genTypes(ctx)'                # regen ctx_ns.d.ts
bun script/repl.ts 'return await ctx.fns.http.loadRoutes(ctx)'     # rescan routes

# reset agent (new SYSTEM_PROMPT picked up lazily)
bun script/repl.ts 'ctx.fns.agent.clear(ctx, { agent: ctx.state.agent.default }); delete ctx.state.agent.default; return "ok"'
```

Server port written to `.hyper/_runtime/port` (default 3000, override via `PORT` env). `script/repl.ts` reads it.

## Database & migrations

`ctx.fns.db` is shared SQLite infra. One connection per process, stored on `ctx.state.db`. Default path: `.hyper/_runtime/sessions` (override via `DB_PATH` env).

**Procedural API** (uniform `(ctx, opts)` calling — see Conventions above):
- `ctx.fns.db.exec(ctx, { sql, params? })` — mutating statements → `{changes, lastInsertRowid}`
- `ctx.fns.db.select<T>(ctx, { sql, params? })` — SELECT → `T[]`
- `ctx.fns.db.insert(ctx, { table, row })` — object-to-INSERT shortcut
- Raw `ctx.state.db` Bun `Database` is available for advanced use (transactions, prepared reuse)

**Migrations:** any file `<module>/$migrate_<timestamp>_<name>.up.sql` gets applied on startup by `ctx.fns.db.migrate(ctx)`. Convention:
- timestamp is `YYYYMMDDHHmmss` (lexicographic = chronological)
- paired `.down.sql` for rollback (not auto-run)
- scanned from both `src/` and `.hyper/`
- applied names stored in `_migrations(name TEXT PK, applied_at INTEGER)`

**Schema (baseline — `src/session/$migrate_20260418000000_init.up.sql`):**

```sql
CREATE TABLE agents (
    id              TEXT PRIMARY KEY,
    model           TEXT NOT NULL,
    system_prompt   TEXT NOT NULL DEFAULT '',
    tools           TEXT NOT NULL DEFAULT '[]',       -- JSON
    scratchpad      TEXT NOT NULL DEFAULT '{}',       -- JSON
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE TABLE messages (                -- one row per OpenAI chat message
    agent_id        TEXT NOT NULL,
    idx             INTEGER NOT NULL,  -- position in agent.messages
    role            TEXT NOT NULL,     -- "user" | "assistant" | "tool" | "system"
    content         TEXT,              -- nullable for tool-only assistant turns
    tool_calls      TEXT,              -- JSON, only on assistant messages
    tool_call_id    TEXT,              -- only on role="tool"
    ts              INTEGER NOT NULL,
    PRIMARY KEY (agent_id, idx)
);

CREATE TABLE events (                  -- one row per UI trace event
    agent_id        TEXT NOT NULL,
    idx             INTEGER NOT NULL,
    type            TEXT NOT NULL,     -- "user" | "thinking" | "tool_call" | "assistant" | "error"
    payload         TEXT NOT NULL,     -- JSON (full event object)
    ts              INTEGER NOT NULL,
    PRIMARY KEY (agent_id, idx)
);
```

**Lifecycle:** `$main.ts` calls `db.connect → db.migrate → session.loadAll` — all persisted agents are rehydrated into `ctx.state.agent[id]` on startup. Mutating ops call `session.save(ctx, agent)` after completing (HTTP create + `agent.run` at end).

## Extension point: `.hyper/`

Both `src/` and `.hyper/` are scanned by the loader, `genTypes`, `loadRoutes`, and `repl.load`. `.hyper/` is **gitignored** and reserved for runtime-written extensions (by the agent itself, mostly).

```
.hyper/
  _runtime/port              ← server writes this
  _runtime/sessions          ← SQLite DB (DB_PATH default)
  skill/
    hello.ts                 → ctx.fns.skill.hello
    $route_todos_GET.ts      → GET /skill/todos
    $type_Todo.ts            → types.skill.Todo
```

`.hyper/` loads AFTER `src/` so it can override core functions by same name. But because it IS scanned, **nothing the app depends on may live here** — see "Core code placement". `_runtime/`, `_test_*/`, `_tmp_*/`, `tmp_*/` are skipped by the scanner and never registered.

## Agent

- **Multi-agent**, keyed by id at `ctx.state.agent[id]` (runtime view; DB is source of truth). Each is addressed by per-id routes (`/agent/:id`, `/agent/:id/events.html`, `/agent/:id/statusbar`, `/fork`, `/archive` …). `GET /` redirects to the most recent agent.
- **No native tool-calls — markers protocol only.** The model emits `§eval` / `§write:<path>` / `§bash` / `§html` / `§read` / `§grep` / `§edit` markers in plain content; `parseMarkers` extracts them, `executeMarker` runs each, and the result is fed back as a synthetic `§result:*` user message on the next turn. See `src/agent/parseMarkers.ts` + `executeMarker.ts`.
- Provider-agnostic via `ctx.fns.llm.stream` (`<provider>:<model-id>` → OpenAI / Anthropic / Codex / mock). Each turn sends the full transcript; prefix cache via `prompt_cache_key`.
- Loop in `src/agent/run.ts`: stream → `parseMarkers` → execute each marker → feed `§result` → repeat until a marker-free (prose-only) reply. Drained by a single in-process `workerLoop` that atomically claims agents off `agents.next_run_at` / `run_state`.
- `agent.scratchpad` (plain object, per-agent) — persists across turns, NOT sent to the model. For stashing fetched data, plans, caches.
- `agent.events[]` — UI trace (user / thinking / tool_call / assistant / error), rendered by the long-poll `GET /agent/:id/events.html`. `agent.messages[]` — the LLM transcript. Both are **synchronized views of the DB**, not the store — mutate via `ctx.fns.session.append*/replace*/syncAgentState`, never `.push()` directly.
- Agent can read/write its own source and hot-reload: `ctx.fns.files.*`, `Bun.write(".hyper/skill/x.ts", ...)`, `ctx.fns.repl.load(ctx, { name: "skill" })`, `ctx.genTypes(ctx)`.

Authoritative agent behaviour lives in `src/agent/SYSTEM_PROMPT_CORE.txt` (+ `SYSTEM_PROMPT.txt` for the markers wire-format), composed by `src/agent/fullSystemPrompt.ts`. Edit those, not the POST handler.

## Adding things (cheat-sheet)

- **New function** in module `foo`: write `.hyper/foo/bar.ts` with anonymous `export default async function (ctx: Context, ...)`, then `ctx.fns.repl.load(ctx, "foo")` + `ctx.genTypes(ctx)`. Now callable as `ctx.fns.foo.bar(ctx, ...)`.
- **New HTTP route**: write `.hyper/<mod>/$route_<path>_<METHOD>.ts`, then `ctx.fns.http.loadRoutes(ctx)`.
- **New type**: `.hyper/<mod>/$type_<Name>.ts` with `export type <Name> = …`, then `ctx.genTypes(ctx)` → `types.<mod>.<Name>` global.
- **New agent capability**: add the function above, tell agent about it by editing `src/agent/SYSTEM_PROMPT.md`, reset the agent.

## Testing discipline

- Run: `bun test` (all) or `bun test ./src/agent/run.test.ts` (one file).
- Type-check: `bunx tsc --noEmit` — must be clean.
- **All tests MUST use the mock LLM (`model: 'mock:*'` → `ctx.fns.llm.streamMock`).** Never hit real LM Studio / OpenAI / Anthropic from the test suite — it's slow, flaky, and a hard dependency on a local server. If a test needs LLM behaviour, drive it through `agent.scratchpad.mockLLM` (see `src/llm/streamMock.ts` and `src/agent/run.test.ts`).
- Don't read `process.env.LMSTUDIO_URL` / `MODEL` / similar in tests as a reason to call out — gate behaviour on `model.startsWith('mock:')` instead.
- Don't invent frameworks — `describe` / `test` / `expect` from `bun:test` only.
- Write file fixtures to `.test-tmp/` (gitignored), NOT into `src/` or `.hyper/` — those are scanned roots and a `.ts` fixture there pollutes `ctx.fns` / `ctx_ns.d.ts`. The shared `mkTestCtx()` lives in `src/_testCtx.entry.ts`.

## Core code placement

**Hard rule: nothing core-related may live in `.hyper/`.** `.hyper/` is gitignored runtime scratch — it must never contain anything the app depends on. Concretely:

- Any core runtime feature, migration, route, queueing logic, persistence schema, type, or agent behavior that is part of the product MUST live under `src/`. If a `.hyper/<mod>/<fn>.ts` ends up imported into the generated `src/ctx_ns.d.ts` (it will, since `genTypes` scans `.hyper/`), core now depends on `.hyper/` — that's the violation. Move it to `src/`.
- `.hyper/` is only for genuinely runtime-generated, experimental, or per-user/agent overlays that the shipped app does not require.
- **Test fixtures never go in a scanned root.** `src/` and `.hyper/` are both scanned by `loadFns`/`genTypes`/`repl.load`; a stray `.ts` fixture there leaks into `ctx.fns` and `ctx_ns.d.ts`. Tests write fixtures to `.test-tmp/` (gitignored, outside both roots — `files.*` sandbox is cwd, so this works). See `src/files/*.test.ts`.
- The scanner (`src/project/scan.ts`) structurally enforces this: directory segments matching `_runtime` / `_test_*` / `_tmp_*` / `tmp_*` are skipped, so junk under those can never be registered. Keep that skip list and `.gitignore` in sync.

## What NOT to do

- Don't use npm packages when a Bun built-in exists (`express`, `ws`, `better-sqlite3`, `glob`, `pg`, `ioredis`, `ts-node`, `dotenv`, `jest`, `vitest`, `node-fetch`, `execa`).
- Don't import project files across module boundaries. Use `ctx.fns`.
- Don't name your `export default` functions.
- Don't write new files under `src/` for agent-produced extensions — use `.hyper/`.
- Don't add `cache_control` markers or stateful `previous_response_id` — LM Studio's automatic prefix cache is enough.
- Don't rename `ctx.fns.agent.run` carelessly — it's the loop everything runs inside.


## UI script routes

- Files like `src/agent/$script_chat.js` are served by the script-route loader as browser assets, not as normal `ctx.fns` functions.
- Changing a `$script_*.js` file may require reloading routes via `ctx.fns.http.loadRoutes(ctx)` rather than only using `ctx.fns.repl.load(ctx, ...)`.
- If a frontend change seems ignored, verify the actual served asset over HTTP (for example `/agent/chat.js`) instead of trusting only the source file on disk.
- After changing a route/UI surface, verify the actually served HTTP output yourself (including .hyper overrides), not just the source file you edited.


## Git helpers

Use built-in git helpers instead of ad-hoc shell commands when possible:
- `ctx.fns.git.run(ctx, args, { dir?, allowFailure? })`
- `ctx.fns.git.stage(ctx, paths, { dir? })`
- `ctx.fns.git.commit(ctx, message, { dir?, allowEmpty? })`
- `ctx.fns.git.push(ctx, { dir?, remote?, branch? })`
- `ctx.fns.git.status(ctx, { dir? })`
- `ctx.fns.git.stageCommitPush(ctx, { paths, message, dir?, push?, allowEmpty?, remote?, branch? })`

These helpers avoid shell-escaping issues (especially with filenames containing `$`) and make it easy to test git flows against a temp repo via the optional `dir` parameter.


## Forked sessions / agents

- Forks should work like in hyper-code: child sessions/agents store `parent_id` + `fork_offset`, not a fully copied transcript.
- The effective LLM-visible transcript must be assembled lazily by chaining parent context recursively, slicing the parent chain at `fork_offset`, then appending the child's own messages.
- For nested forks, offsets must be based on the parent's FULL inherited transcript length, not only the parent's own local message count.
- Keep procedure-per-file discipline when implementing fork behavior; add tests for parent/child, mid-conversation offsets, and nested forks.


## DB-first transcript model

- Treat the database as the source of truth for transcript and event history.
- `agent.messages` and `agent.events` are synchronized runtime views, not the authoritative store.
- Prefer `ctx.fns.session.append* / replace* / syncAgentState` helpers over direct mutation when changing transcript or event history in runtime code.
- For forked agents, effective history should come from `ctx.fns.session.getFullMessages(ctx, agent.id)` semantics, not only local child messages.

- Do not use direct `agent.messages.push(...)` / `agent.events.push(...)` in runtime code; prefer DB-first session helpers.
