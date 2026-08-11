---
description: hyper-code2 — procs-based Bun codebase with a self-extending agent at `/`.
alwaysApply: true
---

# hyper-code2

Procedural TypeScript on Bun, running on the **procs framework** (vendored at `src/procs/` — see `~/health-workspaces/procs` for the upstream). One HTTP server, a multi-agent chat driven by the markers protocol, all code hot-reloadable through a tokened external REPL.

## Runtime environment

- **Bun, not Node.js.** Use `bun`, `bun test`, `bun install`, `bunx`, `bun build`. `.env` loads automatically.
- Prefer Bun built-ins over npm packages: `Bun.serve()`, `Bun.file()`, `Bun.write()`, `Bun.$` shell, `Bun.Glob`, `Bun.spawn`, `bun:sqlite`, `Bun.markdown.html`, etc.
- Tests: `bun:test`. Filename must match `*.test.ts` for auto-discovery.
- **Requires `ripgrep`** (`brew install ripgrep`): `ctx.fns.files.grep` spawns `rg --json` for
  .gitignore-aware search. Without it grep falls back to an in-process scan and says so, loudly,
  in every result — so a missing `rg` is visible to the agent and the user rather than silent.

## The procs contract (calling convention)

- **`ctx.fns` is an injecting Proxy**: `ctx.fns.mod.fn({ ...opts })` calls the raw fn as `raw(ctx, ctx.session, opts)`. Callers NEVER pass ctx.
- Every function file: `export default [async] function (ctx: Context, session: Session | null, opts: {...})` — **anonymous**, one per file, folder = namespace. Zero-arg fns take `(ctx, _session, _opts?: {})`, called as `ctx.fns.mod.fn({})`.
- **No cross-imports between project files** — call through `ctx.fns`. `import` only from `bun`, `node:*`, npm. This is what makes hot reload work.
- State lives on `ctx.state` under the module's own name. Never in module-level variables.
- Types are global via auto-generated `src/ctx_ns.d.ts` (never edit): `mod/Name.ts` (capitalized noun) → `types.mod.Name`; `Context` from `src/Context.ts`, `Session` from `src/Session.ts`. Never `import type` project types.
- The framework's own modules live under `ctx.fns.procs.*` (`procs.db`, `procs.http`, `procs.repl`, `procs.dev`, `procs.events`, `procs.config`, `procs.log`, `procs.migrate`, …) and can't be shadowed. Full contract: upstream `PROCS.md`.

## File-name grammar ($-prefix = parsed by the scanner)

| file | becomes |
|---|---|
| `mod/fn.ts` (verb, lower-case) | `ctx.fns.mod.fn` |
| `mod/Name.ts` (noun, capitalized) | `types.mod.Name` (compile-time only) |
| `mod/$route_<path>_<METHOD>.ts` | route; `_`→`/`, `$id`→`:id`; handler `(ctx, session, { req, params })` |
| `mod/$middleware[_<path>].ts` | middleware under that prefix |
| `mod/$start.ts` / `$stop.ts` | lifecycle, in `package.json procs.prod` order |
| `mod/$config.ts` | config schema → `ctx.fns.procs.config.resolve({ module })` |
| `mod/$migration_<id>.ts` | db migration (`{up, down?}`), applied by `procs.migrate.up` in id order |
| `mod/$setting_<key>.ts` | declared runtime setting (owned by `settings/$loader_setting.ts`) → `ctx.state.settings.registry` |
| `mod/$script_<n>.js\|css` | browser asset, bundled, served at `/mod/<n>.js` |
| `mod/$cli_<cmd>.ts` | CLI command (`bun script/cli.ts <cmd>`) |
| `$main.ts` · `$test.ts` · `*.test.ts` · `*.entry.ts` · `*.d.ts` | skipped by the scanner |

## Layout

```
src/
  $main.ts            procs boot (makeCtx + injecting Proxy) — entry
  $test.ts            testCtx for bun tests (root defaults to this repo)
  Context.ts          global Context type (framework)
  Session.ts          global Session type (request session — NOT the agent transcript)
  ctx_ns.d.ts         AUTO-GEN by ctx.fns.procs.dev.genTypes
  procs/              VENDORED framework — ctx.fns.procs.* (patched: .hyper overlay
                      root in modules/discover, _migrations name→id compat, WAL)
  agent/              markers protocol loop: run, workerLoop, executeMarker, parseMarkers,
                      routes /agent/:id*, $start.ts (loadAll + workerLoop), SYSTEM_PROMPT_CORE.txt
  session/            DB-first agent persistence (agents/messages/events) + $migration_*.ts
  llm/                stream dispatch by "provider:model" + OAuth refreshers + streamMock
  files/ ui/ markdown/ git/ settings/ events/ dev/ skill/ tools/
script/repl.ts        external REPL client (reads .runtime/port + .runtime/repl-token)
.runtime/             port, repl-token, signing key, bundled scripts (gitignored)
.hyper/               runtime-writable overlay — scanned AFTER src/, overrides by name;
                      _runtime/sessions is the LEGACY sqlite file (storage is Postgres now)
```

## Server, REPL, hot reload

Long-running server in tmux session `hyper` on **PORT 3010** (`bun run start`; :3000 is a different project).

```bash
tmux new-session -d -s hyper 'cd ~/hyper-code2 && bun run start'

bun script/repl.ts 'ctx.fns.session.list({})'          # eval inside the live process
bun script/repl.ts -f /tmp/play.js                     # from file; stdin works too
```

- `POST /procs/repl` is gated: run-signed JWT in `.runtime/repl-token` (0600) + loopback-only + 403 in production. `script/repl.ts` handles the token automatically.
- REPL eval is Jupyter-style: `console.log`/`print` captured, last expression returned.
- Hot reload: `ctx.fns.procs.dev.sync({ rel: "agent/run.ts" })` picks up an edited file (any kind); `ctx.fns.procs.repl.load({ name: "agent.run" })` swaps one fn or a module; `ctx.fns.procs.dev.genTypes({})` regenerates types; `ctx.fns.procs.http.loadRoutes({})` rescans routes; `ctx.fns.procs.migrate.up({})` applies new migrations. The dev **watcher** does sync automatically on save (dev only; `WATCH=0` opts out).
- Needs a restart: `$main.ts`, any `$start/$stop`, and long-lived closures (notably `workerLoop`) — reload swaps the fn but the old promise keeps spinning.
- Introspection: `ctx.fns.procs.dev.doc({ name: "agent.run" })`, `ctx.fns.procs.dev.where({ name })`, `ctx.fns.procs.dev.lint({})`.

## Database & migrations

- **Storage is Postgres** (paradedb via `~/.hyper/docker-compose.yml`, container `hyper-db`, port **54393**, db/user/pass `hyper`). Start with `cd ~/.hyper && docker compose up -d`.
- `ctx.fns.procs.db.*` — ALL ASYNC: `select({sql, params})` → rows, `run({sql, params})` → `{changes, lastInsertRowid: 0, rows}` (use RETURNING + `.rows` or `insert` for ids), `insert({into, values})` → `{id, changes}`, `exec({sql})` (multi-statement DDL, no params), `conn()` → Bun.SQL pool. `?` placeholders are translated to `$n` internally — keep writing `?`.
- NEVER use bare `Bun.sql`/`new SQL()` in app code — it defaults to localhost:5432, not our db.
- URL from `package.json procs.prod."procs/db".url` (env `DATABASE_URL` overrides). Pool `prepare: false` (Bun 1.3.14 pipelining bug — don't remove).
- Postgres dialect notes: ms-timestamps are BIGINT (come back as strings — wrap in `Number()`), `COUNT(*)` is bigint-string too, camelCase aliases need quotes (`AS "createdAt"`), `GREATEST` not scalar `MAX`, `ILIKE` not `COLLATE NOCASE`.
- Tests: each test ctx gets a private **pg_temp** schema on a one-connection pool (self-cleaning); pools are closed per-file by `src/_testPreload.entry.ts` (bunfig `[test].preload`). `max_connections=1000` on the container. CI runs a paradedb service.
- Migrations: `mod/$migration_<id>.ts` default-exporting `{ up(ctx), down?(ctx) }` (async), tracked in `_migrations(id)`. Ids are `YYYYMMDDHHmmss_name`.
- One-shot sqlite→pg data copy: `script/migrate-sqlite-to-pg.ts` (already run; old file kept at `.hyper/_runtime/sessions`).

## Agent (unchanged core design)

- **Markers protocol only** — `§eval` / `§write:<path>` / `§bash` / `§html` / `§read` / `§grep` / `§edit` in plain content; `parseMarkers` → `executeMarker` → synthetic `§result:*` user message; loop until prose-only reply (`src/agent/run.ts`).
- Multi-agent at `ctx.state.agent[id]` (runtime view; **DB is source of truth**). Mutate transcript/events via `ctx.fns.session.append*/replace*/syncAgentState` — never `.push()` directly in runtime code.
- Queue: `agents.next_run_at` + `run_state` + `last_processed_msg_idx`; single in-process `workerLoop` claims atomically (`UPDATE … RETURNING id`), started by `agent/$start.ts`.
- Agent-visible behaviour lives in `src/agent/SYSTEM_PROMPT_CORE.txt` (+ `SYSTEM_PROMPT.txt` wire format), composed by `fullSystemPrompt`. It teaches the NEW calling convention — keep it in sync when conventions change.
- Forks: child stores `parent_id` + `fork_offset`; effective transcript via `ctx.fns.session.getFullMessages({ id })` — never copy transcripts.

## Testing discipline

- `bun test` (436+ tests) and `bunx tsc --noEmit` must both be clean.
- Shared fixture: `mkTestCtx()` from `src/_testCtx.entry.ts` — boots the real registry (full Proxy ctx, `:memory:` db, migrations, routes), scrubs env for determinism, and stubs `markdown.highlight/render` + `repl.eval`. Override stubs via `ctx.state.registry.<mod>.<fn> = (_c, _s, opts) => …` (raw signature!).
- Route tests go through `ctx.fns.procs.http.dispatch({ method, url, body, headers })` → real `Response`.
- **All tests use `model: 'mock:*'`** (`streamMock`; drive via `agent.scratchpad.mockLLM` — `echoUser`/`userText`/`defaultText`). Never hit real LLM providers in the suite.
- Fixtures go to `.test-tmp/` (gitignored) — NEVER into `src/` or `.hyper/` (both are scanned roots).

## Core code placement

**Nothing the app depends on may live in `.hyper/`** — it's the gitignored runtime overlay for agent-written extensions. Core features/migrations/routes/types go under `src/`. The scanner skips `_runtime`, `_test_*`, `_tmp_*`, `tmp_*`, `node_modules` segments.

Vendored `src/procs/` is upstream code: keep local patches minimal and marked with a `hyper-code2:` comment; prefer fixing upstream and re-vendoring.

## What NOT to do

- Don't use npm packages where a Bun built-in exists.
- Don't import project files across module boundaries; don't name default exports.
- Don't pass `ctx` at call sites (`ctx.fns.x.y(ctx, …)` is the OLD convention — the Proxy injects it).
- Don't mutate `agent.messages`/`agent.events` directly in runtime code — session helpers only.
- Don't rename `ctx.fns.agent.run` / `workerLoop` carelessly.
- Don't edit `src/ctx_ns.d.ts` (generated) or add files under `src/procs/` for app features.

## UI frame (workspace-style)

- Layout (`src/ui/layout.ts`): the agent chat is a persistent LEFT column (`ui.chatColumn({agentId})`, resizable, sticky current agent via `ctx.state.uiCurrentAgent`); pages render on the RIGHT under the module tab bar (`ui.topbar`). Tab links are hx-boosted into `#main` only — the chat and its long-poll survive page switches; switching AGENTS is a full load on purpose.
- `GET /agent/:id` is the agent's overview/passport page (right pane) and sets the current agent.
- ⌘K palette (`ui.navMenu` island + `nav.items` + `GET /nav/items`): agents, built-in pages, and every mounted module's top-level GET pages. Module tabs come from procs modules metadata (`m.tab`), uniskill-style: mount a module → it shows up in nav.

## screen & tour (ported from health-workspaces)

- `ctx.fns.screen.*` drives the tab the person already has open — no browser in
  the process: `screen.eval` pushes code down the SSE stream, the tab answers at
  `POST /screen/result` (handler in ui/controlScript). Verbs: `open` (partial
  nav into #main) · `click` · `fill` · `submit` · `point` (pointer+ring+caption)
  · `say` · `readScreen` (the data-* catalogue) · `text` · `where` (last beacon,
  no round trip).
- Targets are addressed by `procs.ui.attr` data-* markers (page/entity/id/form/
  action/role), NEVER CSS selectors. Seeded so far: topbar tabs (action:
  open-tab), chat form (form: chat), agent picker (role), search page/form/hits,
  agent passport (page: agent + fork/archive/delete actions). New UI should
  carry markers from birth.
- `ctx.fns.tour.play({steps})` — scripted walk (Back/Next/Show me); `tour.review`
  checks steps against pages with no browser; `screen.step` — live tour, one
  step per turn; the person's press comes back through the `screen.press` hook
  → `agent/$hook_screen.press.ts` drops "[tour] the user pressed …" into the
  CURRENT agent's queue.
- The pointer/tour CSS lives in the framework sheet — the layout links
  `ctx.state.procs.styles` (procs/styles/app.css); don't remove that link.

## UI script routes

- `$script_*.js` files are served as bundled browser assets by `procs/http/$loader_script.ts`, not as fns. After changing one, `ctx.fns.procs.http.loadRoutes({})` (or dev.sync) and verify the actually served HTTP output (e.g. `/agent/chat.js`), including `.hyper` overrides — not just the file on disk.
- The app layout is `src/ui/layout.ts` (procs `toResponse` picks `registry.ui.layout` over the framework default). String / `{main, title}` returns from routes are wrapped by it; `Response` passes through.

## Git helpers

`ctx.fns.git.run/stage/commit/push/status/stageCommitPush({ ... })` — use these from agent code instead of ad-hoc shell (they handle `$`-filenames and take an optional `dir` for temp-repo tests).
