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

  db/                      ctx.fns.db.* — stubs only
```

## Conventions

- `export default async function (ctx: Context, ...)` — **anonymous**, no function name.
- Cross-file calls go through `ctx.fns.<ns>.<fn>(ctx, ...)`. **No cross-imports between project files.** Only `import` from `bun`, `node:*`, or third-party.
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
bun script/repl.ts 'await ctx.fns.repl.load(ctx, "agent")'         # whole folder
bun script/repl.ts 'await ctx.fns.repl.load(ctx, "agent.run")'     # single fn
bun script/repl.ts 'return await ctx.genTypes(ctx)'                # regen ctx_ns.d.ts
bun script/repl.ts 'return await ctx.fns.http.loadRoutes(ctx)'     # rescan routes

# reset agent (new SYSTEM_PROMPT picked up lazily)
bun script/repl.ts 'ctx.fns.agent.clear(ctx, ctx.state.agent.default); delete ctx.state.agent.default; return "ok"'
```

Server port written to `.hyper/port` (default 3000). `script/repl.ts` reads it.

## Extension point: `.hyper/`

Both `src/` and `.hyper/` are scanned by the loader, `genTypes`, `loadRoutes`, and `repl.load`. `.hyper/` is **gitignored** and reserved for runtime-written extensions (by the agent itself, mostly).

```
.hyper/
  port                       ← server writes this
  skill/
    hello.ts                 → ctx.fns.skill.hello
    $route_todos_GET.ts      → GET /skill/todos
    $type_Todo.ts            → types.skill.Todo
```

`.hyper/` loads AFTER `src/` so it can override core functions by same name.

## Agent (at `/`)

- Single live agent stored at `ctx.state.agent.default`.
- **Exactly one tool: `evalCode`**, declared in `src/agent/$route__POST.ts`. Agent writes JS, `ctx.fns.repl.eval` runs it with `ctx` and `agent` bound.
- Stateless `/v1/chat/completions` to LM Studio (`LMSTUDIO_URL`, `MODEL` from env / `.env.test`). No `previous_response_id` — each turn sends full `agent.messages`, prefix cache via `prompt_cache_key: agent.id`.
- Loop in `src/agent/run.ts`: user → stream → tool_calls → execute → tool results → stream → … until no tool_calls.
- `agent.scratchpad` (plain object, per-agent) — persistent across turns, NOT sent to the model. For stashing fetched data, plans, caches.
- `agent.events[]` — UI trace (user / tool_call / assistant / error). Surfaced via `GET /agent?offset=N`.
- `agent.messages[]` — OpenAI chat transcript (user / assistant / tool). What the model sees.
- Agent can read/write own source and hot-reload: `Bun.file("src/agent/run.ts").text()`, `Bun.write(".hyper/skill/x.ts", ...)`, `ctx.fns.repl.load(ctx, "skill")`, `ctx.genTypes(ctx)`.

Authoritative agent behaviour lives in `src/agent/SYSTEM_PROMPT.md`. Edit that file, not the POST handler.

## Adding things (cheat-sheet)

- **New function** in module `foo`: write `.hyper/foo/bar.ts` with anonymous `export default async function (ctx: Context, ...)`, then `ctx.fns.repl.load(ctx, "foo")` + `ctx.genTypes(ctx)`. Now callable as `ctx.fns.foo.bar(ctx, ...)`.
- **New HTTP route**: write `.hyper/<mod>/$route_<path>_<METHOD>.ts`, then `ctx.fns.http.loadRoutes(ctx)`.
- **New type**: `.hyper/<mod>/$type_<Name>.ts` with `export type <Name> = …`, then `ctx.genTypes(ctx)` → `types.<mod>.<Name>` global.
- **New agent capability**: add the function above, tell agent about it by editing `src/agent/SYSTEM_PROMPT.md`, reset the agent.

## Testing discipline

- Run: `bun test` (all) or `bun test ./src/agent/run.test.ts` (one file).
- Type-check: `bunx tsc --noEmit` — must be clean.
- Integration tests hit real LM Studio when `process.env.LMSTUDIO_URL` is set (via `.env.test`).
- Don't invent frameworks — `describe` / `test` / `expect` from `bun:test` only.

## What NOT to do

- Don't use npm packages when a Bun built-in exists (`express`, `ws`, `better-sqlite3`, `glob`, `pg`, `ioredis`, `ts-node`, `dotenv`, `jest`, `vitest`, `node-fetch`, `execa`).
- Don't import project files across module boundaries. Use `ctx.fns`.
- Don't name your `export default` functions.
- Don't write new files under `src/` for agent-produced extensions — use `.hyper/`.
- Don't add `cache_control` markers or stateful `previous_response_id` — LM Studio's automatic prefix cache is enough.
- Don't rename `ctx.fns.agent.run` carelessly — it's the loop everything runs inside.
