# hyper-code2

A self-extending AI agent server on Bun. ~1000 LOC, one tool (`evalCode`), procedural TypeScript.

## What it is

A tiny HTTP server that hosts a chat-driven agent at `/`. The agent has **exactly one tool** — `evalCode` — which runs JavaScript in the same Bun process. Through that single tool, the agent can:

- Compute anything (math, data processing, crypto, compression, …) via the Bun runtime.
- Talk to the network (`fetch`), the disk (`Bun.file` / `Bun.write`), the shell (`` Bun.$ ``), databases (`bun:sqlite`, `Bun.sql`, `Bun.redis`), S3, etc.
- **Read its own source code** (`Bun.file("src/agent/run.ts").text()`).
- **Write new procedures** to `.hyper/<module>/<fn>.ts` and hot-reload them into the live runtime — no restart.
- Add new HTTP routes on the fly (`$route_*.ts` → dynamic dispatch).
- Mutate its own state, messages, tools, system prompt between turns.
- Stash working data in `agent.scratchpad` so big payloads never pollute the LLM context.
- Compact its own history (`ctx.fns.agent.compact(ctx, agent, …)`) when tool results grow too large.

The philosophy: give the model a full programming language + the running process as its "tool set", and let it extend itself.

## Architecture in one picture

```
Browser (chat UI)  ──POST /agent──▶  run loop  ──▶  LM Studio /v1/chat/completions
     ▲                                  │
     │                                  ▼  tool_calls → evalCode
     │                             ┌────────────┐
     └──GET /agent?offset=N────────┤ agent.events│
                                   │ agent.messages
                                   │ agent.scratchpad
                                   └────────────┘
```

- **Single file per function.** Folder = namespace. `src/<mod>/<fn>.ts` → `ctx.fns.<mod>.<fn>`. Inspired by [proc-ts](https://github.com/niquola/proc-ts).
- **Global types** auto-generated from the filesystem into `src/ctx_ns.d.ts`. No imports of `Context`, `types.agent.Agent` needed anywhere.
- **Dynamic routing.** `Bun.serve` with a single `fetch` handler that matches against a mutable `ctx.routes`. New routes take effect on the next request — no `server.reload()`, no restart.
- **Stateless LLM protocol.** Each turn sends the full `messages[]` to LM Studio with a `prompt_cache_key` for prefix-cache. We do NOT use `previous_response_id` — that caused runaway context growth with minimax's reasoning tokens.
- **Hot-reload.** `ctx.fns.repl.load(ctx, "<mod>")` re-imports a file with cache-busting, replaces the fn in `ctx.fns` — the rest of the process keeps running.
- **`.hyper/` extension point.** Gitignored sibling of `src/` loaded by the same scanners. Where the agent writes its own code.

## Layout

```
src/
  $main.ts              entry: loadFns → genTypes → loadRoutes → http.start
  $route_GET.ts         GET /  — Tailwind-powered chat UI
  $type_Context.ts      global Context type
  genTypes.ts           scans src/ + .hyper/ → writes ctx_ns.d.ts
  ctx_ns.d.ts           AUTO-GENERATED — never edit

  agent/                ctx.fns.agent.*
    SYSTEM_PROMPT.md    agent behavior, editable in place
    start / stream / run / compact / clear / stop / systemPrompt
    $type_Agent.ts      types.agent.Agent
    $route_*.ts         POST/GET/DELETE /agent, POST /agent/stop

  markdown/             ctx.fns.markdown.*
    render.ts           Bun.markdown.html + shiki post-processing
    highlight.ts        shiki wrapper, lazy-init

  repl/                 ctx.fns.repl.*
    eval.ts             new Function("ctx", ...) + extra bindings
    load.ts             hot-reload a fn or a folder (src/ and .hyper/)
    $route__POST.ts     POST /repl — exposes eval over HTTP

  http/                 ctx.fns.http.*
    $start.ts           Bun.serve with dynamic dispatch
    match.ts            path matcher (static + :params)
    loadRoutes.ts       scans $route_*.ts files into ctx.routes

.hyper/                 runtime-writable, gitignored
  port                  server writes current port here
  <agent-generated>/    whatever the agent decides to add

script/
  repl.ts               CLI: sends JS to POST /repl, reads .hyper/port
```

## The one tool: `evalCode`

```json
{
  "name": "evalCode",
  "description": "Execute a JavaScript expression or statements. Returns the serialized result.",
  "parameters": {
    "type": "object",
    "properties": { "code": { "type": "string" } },
    "required": ["code"]
  }
}
```

When the model emits a tool call with this name, `src/agent/run.ts` passes `args.code` to `ctx.fns.repl.eval` with two bindings in scope: **`ctx`** (the runtime) and **`agent`** (the agent's live state). Everything else — Bun APIs, `fetch`, `crypto`, dynamic imports — is just the ambient Bun runtime.

Typical agent turn:

```js
// model emits:
ctx.fns.markdown.render(ctx, "## heading\n- a\n- b")
// result is serialized (Bun.inspect), returned to the model as the tool result
```

Bigger example — agent extending itself:

```js
// Turn 1: write a new skill
await Bun.write(".hyper/skill/wordCount.ts", [
  "export default async function (ctx: Context, text: string) {",
  "    return { words: text.trim().split(/\\s+/).filter(Boolean).length, chars: text.length, lines: text.split('\\n').length };",
  "}",
].join("\n"));

// Turn 2: hot-load + regen types
await ctx.fns.repl.load(ctx, "skill");
await ctx.genTypes(ctx);

// Turn 3: use it
await ctx.fns.skill.wordCount(ctx, "The quick brown fox jumps over the lazy dog");
// → { words: 9, chars: 43, lines: 1 }
```

## Context economy

The full `agent.messages` ships to the model every turn. Rules baked into `SYSTEM_PROMPT.md`:

- **Peek at shape first** — `({ keys: Object.keys(x), len: x?.length })` before returning the whole payload.
- **Stash in `agent.scratchpad`** — a plain object the model can read/write across turns but that is NOT sent to the LLM. Use for fetched JSON, intermediate results, plans, caches.
- **Compact after the fact** — `ctx.fns.agent.compact(ctx, agent, "summary")` rewrites the last tool result in place. Or `compact(ctx, agent, { message: 5, summary: "…" })` drops everything from index 5 onward and replaces it with a synthetic user note (walks back if it would orphan a tool call).

## Quick start

```bash
# 1. install
bun install

# 2. point at LM Studio (or any OpenAI-compatible endpoint with tool calling)
cp .env.test .env   # LMSTUDIO_URL=http://localhost:1234, MODEL=minimax/minimax-m2.7

# 3. run
tmux new-session -d -s hyper 'bun src/$main.ts'

# 4. chat
open http://localhost:3000/
```

## LLM providers & auth

Models are addressed as `<provider>:<model-id>`. The prefix picks the endpoint and
protocol; the API key is pulled from an env var or a local credentials file:

| prefix          | endpoint                             | auth                                   |
| --------------- | ------------------------------------ | -------------------------------------- |
| *none* / `lmstudio:` | `LMSTUDIO_URL` (default `:1234`)     | none (local)                           |
| `openai:`       | `https://api.openai.com/v1`          | `OPENAI_API_KEY`                       |
| `anthropic:`    | `https://api.anthropic.com`          | `ANTHROPIC_API_KEY`                    |
| `kimi:`         | `https://api.moonshot.ai/v1`         | `KIMI_API_KEY` (Moonshot console key)  |
| `kimi-coding:`  | `https://api.kimi.com/coding`        | `KIMI_CODING_API_KEY` OR JWT from `~/.kimi/credentials/kimi-code.json` |
| `groq:`         | `https://api.groq.com/openai/v1`     | `GROQ_API_KEY`                         |
| `openrouter:`   | `https://openrouter.ai/api/v1`       | `OPENROUTER_API_KEY`                   |

`kimi:` and `kimi-coding:` are **different services** — `kimi:` is the pay-per-token
Moonshot API (OpenAI-compat), `kimi-coding:` is the monthly subscription that the
`kimi` CLI uses (Anthropic-compat). If you get `{"type":"incorrect_api_key_error"}`
you hit Moonshot without a Moonshot key; pick `kimi-coding:` instead.

### Token handling (no caching)

`src/llm/resolveEndpoint.ts` reads credentials on every call — nothing is cached
in memory. For `kimi-coding:` the JWT is read fresh from
`~/.kimi/credentials/kimi-code.json` (which `kimi login` maintains). Before
returning the token we decode its `exp` claim; if expired, we return `null`
and print a warning so you fail loud instead of getting a confusing 401. Run
`kimi login` to refresh.

## REPL workflow

The server stays up. Everything iterates without restart:

```bash
bun script/repl.ts '1 + 1'                                      # quick eval
bun script/repl.ts 'return Object.keys(ctx.fns)'                # introspect
bun script/repl.ts -f /tmp/play.js                              # from file
echo 'return ctx.state' | bun script/repl.ts                    # stdin

bun script/repl.ts 'await ctx.fns.repl.load(ctx, "agent")'      # reload folder
bun script/repl.ts 'return await ctx.genTypes(ctx)'             # regen types
bun script/repl.ts 'return await ctx.fns.http.loadRoutes(ctx)'  # rescan routes
```

## Testing

```bash
bun test              # all tests (bun:test auto-discovers *.test.ts)
bunx tsc --noEmit     # type check — must be clean
```

Integration tests for `agent/stream.ts` and `agent/run.ts` hit real LM Studio when `LMSTUDIO_URL` is set (via `.env.test`, auto-loaded by `bun test`).

## Why "procedural, not OO"

Inspired by [proc-ts](https://github.com/niquola/proc-ts). Consequences:

- **One file, one function, anonymous default export.** No classes, no base abstractions, no DI containers.
- **No cross-imports of project files.** Call other procedures via `ctx.fns.<ns>.<fn>(ctx, …)`. This is what makes hot-reload actually work: swapping a file in `ctx.fns` updates every call site instantly.
- **Types live next to code in `$type_*.ts` files.** Scanned into a single generated `ctx_ns.d.ts` with `declare global` — no imports of `Context`, `types.agent.Agent` at usage sites.
- **`$`-prefixed filenames carry intent:** `$main.ts` is the entry; `$start.ts` is a conventional lifecycle fn; `$route_<path>_<METHOD>.ts` is an HTTP route (`_` = `/`, `$foo` = `:foo`); `$type_<Name>.ts` is a type. Everything else is a plain function.

This style is deliberately biased: optimized for an LLM-agent-driven codebase where the agent reads, writes, and hot-reloads files by itself.

## What's not here (by design)

- No build step. Bun runs TS directly.
- No framework (no Express, no Next.js, no Vite). `Bun.serve`, `Bun.file`, `Bun.markdown`, `bun:test` cover everything.
- No npm equivalents where a Bun built-in exists.
- No streaming tokens to the UI yet — `/agent` returns immediately, the UI polls `GET /agent?offset=N`. This is enough for a usable chat and avoids a WebSocket layer.
- No multi-agent orchestration (yet). One agent at `ctx.state.agent.default`.

## License

MIT.
