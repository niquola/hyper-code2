# What to take from DeepSeek Harness

A read of [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness)
(cloned at `~/deepseek-harness`, 12 293 commits) against hyper-code2, written for the
people and agents working in this repo. It answers one question: **which of their ideas
pay for themselves here**, given that we are deliberately a different kind of program.

## The two shapes

|  | dsh | hyper-code2 |
|---|---|---|
| Size | 54 packages, ~453k lines TS, pnpm monorepo | ~32k lines, one package |
| Runtime | Node ≥22, build step (`tsc` + `tsdown`) | Bun, no build |
| Composition | Cordis plugin tree assembled from config (profiles → bundles → patch files) | file-name grammar scanned from disk (`$tool_`, `$route_`, `$loader_`) + `.hyper` overlay |
| Extending it | mount a plugin, restart | save a file, live in ~3s |
| UI | React app over a JSON-RPC/ACP gateway | server-rendered htmx |
| Model protocol | native JSON tool calls | native JSON tool calls |

Their thesis is *everything is a plugin, composition is data*: the model adapter, the tool
registry, the session log and the agent loop are all plugins, and a deployment is a
config tree you can print (`dsh --profile web --dump-config`) and patch row by row. It is
a serious answer to "how does a company ship one harness to many deployments".

Our thesis is *the running program is the source*: an agent writes a file and the system
it lives inside changes without a restart. That is a different product, and most of their
machinery is the price of their thesis, not a lesson for ours.

## Not worth taking

- **Cordis / DI container.** Their `ctx` is a dependency-injection tree with reversible
  effects; ours is a Proxy over a registry rebuilt from disk. Adopting theirs would cost
  us hot reload — our single largest advantage — to buy configurability we do not need
  for one machine and one user.
- **The monorepo, profiles and bundles.** 54 packages exist so third parties can ship
  distributions. We have one deployment. Splitting would add a build step to a system
  whose whole point is not having one.
- **React web app.** We render on the server precisely so the chat survives a swap; their
  postmortem 0003 is a browser-app failure mode we do not have.
- **100% per-file coverage gate.** Reasonable at their size and funding; here it would
  buy line coverage of glue and cost the time we spend on real-composition checks (below).

## Worth taking — ranked

### 1. A tool's output is a declared contract, not free-form HTML

**Them.** `ToolDefinition` must declare `output`: a JSON Schema every successful value is
validated against, a pure `render(args, value) → ContentBlock[]` projection to what the
model sees, and an optional `presentationMeta(args, value)` for the UI. The registry's
`schemas()` builds the model-facing payload from an explicit **allowlist**, so `execute`,
timeouts and presenters cannot leak into a request. The presentation payload rides along
with the result in the log (`tool/result.meta`), so **replay reproduces the identical
card** without re-running any renderer.

**Us.** `$tool_*.md` declares `parameters` and prompt docs; the result is a string, and
every render recomputes HTML from the event (`renderEventsHtml` deliberately never
caches). That is why a half-landed refactor of one card (`ui.popup is not a function`)
could take down every page of an agent, and why a model's loose JSON (reflection
`reasons` as a sentence) reached `.map`. Both were view crashes over undeclared shapes.

**Smallest version here.** Add an optional `output:` block to the `$tool_*.md`
declaration — a schema plus the dotted name of a pure render fn — and store the
presentation payload next to the tool result row (we already have `jsonb` available).
Renderers then project stored data instead of re-deriving it, and a tool that returns
something unexpected fails at the tool boundary, where it is one card, not at page render.

### 2. Log the request header: "model-visible means logged"

**Them.** Anything that reaches a model request must be reconstructable from the session
log, asserted at runtime. A `request/header` event records the full header for the next
request (provider, model, prompt sections, tool schema set), appended inside the step
before dispatch, and `request/context` records route/capacity changes.

**Us.** We persist messages and events, but the *envelope* — which system prompt, which
tool schemas, which provider settings produced this assistant message — exists only in
memory at call time. Every "why did it do that" investigation becomes archaeology, and
our `no tool output found for function call` incident took a live reproduction to explain.

**Smallest version here.** One `request_header` event per step, containing the model
string, a hash of the assembled system prompt, the tool names offered, and the cursor
range. Cheap, append-only, and it turns "the agent went weird at 16:14" into a diff.

### 3. Durable turns, so a crash cannot leave `running` forever

**Them.** `turn/start` / `turn/end{reason}` and `step/start` / `step/end` are durable log
events. A turn that spent no step still closes with a reason, so the log records the
attempt; an unmatched open marker is *detectable evidence* of a crash mid-operation
(their compaction lock uses exactly this — release last, so a crash leaves an orphan you
can see rather than a false "finished").

**Us.** `agents.run_state` + `next_run_at` is state without history. After today's
restart, `oc` and `ehk` stayed `running` forever with nothing to reconcile them against,
because nothing recorded that a turn had opened. This is the same bug class their lock
design prevents.

**Smallest version here.** Append `turn/start` and `turn/end{reason}` events; on boot,
close turns whose start has no end and reset the agent to idle. That single pass removes
the "stuck running after restart" class permanently.

### 4. The repeat-tool loop breaker

**Them.** `dsh-repeat-tool-reminder` is not a tool and never vetoes: it keys a
`WeakMap<Agent, Chain>` on `(tool name, canonicalized arguments)`, counts consecutive
identical calls, and at thresholds `[3, 5, 8]` injects an escalating advisory to stop
repeating, re-read the last result, and change approach. Denied calls count. Excluded
bookkeeping tools are transparent to the chain, so `grep X → todo_write → grep X` still
counts as two.

**Us.** We have watched agents loop for real — including today, where a cancelled Telegram
prompt made the login retry forever and an agent re-issued `telegram.reauth` after every
edit. We have no generic loop detector at all.

**Smallest version here.** ~50 lines in `tools.call`: canonical-argument hash per agent,
counter, and an injected user message at thresholds. It is advisory, so it can never
block legitimate repetition.

### 5. Spill: big outputs get a locator, not a place in memory

**Them.** A `tools/post-execute` policy hands oversized text to `ctx.spillStore.saveText`,
which persists it to a private session-scoped file (0700 dir, random name, `wx`/0600
open) and returns a locator, a **retrieval hint** and the exact byte count. The model gets
a handle plus instructions; nothing large rides in the transcript.

**Us.** We truncate and stash the full text in `agent.scratchpad.results["r38"]`, telling
the model to read it back through `eval`. It works, but it lives in process memory,
survives no restart, and the guidance is improvised per call site.

**Smallest version here.** Keep the truncation policy, change the destination: write to a
file under `.runtime/spill/<agent>/`, return `{ locator, bytes, howToRead }`, and let
`read` accept the locator. Restart-proof and uniform.

### 6. A guarded execution pipeline with deny / ask

**Them.** Every call passes `tools/pre-execute` (hooks, permission, sandbox) → monotonic
guards → `tools/execute` (timeout, retry, metrics as an *around* wrapper) →
`tools/post-execute` (accept, block, replace, add context). Approval is a one-shot prompt;
absent or unanswerable means deny. Policy attaches without any tool importing it.

**Us.** `tools.call` validates arguments and runs the implementation. There is no seam for
approval, timeouts or sandboxing — every such rule would have to be written inside each
tool.

**Smallest version here.** Two hook points around the existing call — `tools.beforeCall`
and `tools.afterCall`, resolved by dotted name from declarations — is enough to host
timeouts, an approval prompt for destructive tools (we already have `secureInput`), and
the loop breaker above.

### 7. Postmortems and Agent Notes as a repo practice

**Them.** `docs/postmortem/NNNN-*.md` records incidents whose interesting part is *why
every safety net missed it*, written when a bug is subtle, systemic and costly to
rediscover; each opens with a 30-second executive summary and ends with the guardrails
added. Separately, `.agents/notes/{proposed,implemented,rejected,archived}/{class}/` keeps
design decisions and what was rejected, kept current with what shipped.

**Us.** The knowledge lives in commit messages (good ones) and in this conversation.
Today alone produced three textbook candidates: htmx attribute inheritance eating the
page, a half-landed refactor 500ing every agent page, and a login retry loop that
outlived reloads because its closure sat inside a running `client.start()`.

**Smallest version here.** `docs/postmortem/` with their template. It costs ten minutes
per incident and pays every time an agent re-derives the same mechanism.

### 8. Two headings in every module README: *Model Experience* and *KV cache effect*

**Them.** Every package README states how the module appears to the model (or "indirectly,
through X") and what it does to the request prefix — because a change that reorders prompt
content silently destroys prefix caching.

**Us.** `$tool_*.md` bodies already are prompt content, assembled by `fullSystemPrompt`.
Nobody records what an edit does to cache reuse, so nobody notices when it degrades.
Two headings, near-zero cost.

### 9. Test what actually ships, not what the mock says

**Them.** "Verify the world, not the self-report" — an e2e assertion re-runs the command or
re-reads the file externally; "test the real entry path" — run the built binary, not the
source, because that exposes settle races and swallowed load failures; and a guard only
guards if the regression actually fails it (introduce the bug, watch it go red, revert).
Snapshot lanes pin assembled prompts and rendered browser output.

**Us.** 538 unit tests, all green — and **every** breakage of the last two days was
invisible to them, because they were composition and runtime-registry failures: an
attribute inherited from a parent element, a fn missing from the live registry, a stale
client script served from an inlined import. Our tests exercise fns; the product is a
running server.

**Smallest version here.** A boot-the-real-thing smoke lane: start the app in a test,
`GET /agent/:id` through the real dispatcher, assert the markers that matter (`#chat-panel`
present, no `hx-target` on containers holding live regions, tool cards render). We already
have `procs.http.dispatch` — this is a handful of tests, and it covers the class our suite
structurally cannot.

### 10. Generated catalogs

**Them.** Their `docs/config-catalog.md`, `tool-catalog.md`, `persistence-catalog.md` and
`module-graph.md` are generated from source by `pnpm run gen-doc-graphs`, so documentation
cannot drift from the code.

**Us.** We have `procs.dev.doc/where/lint` for introspection but no generated catalog. A
tool catalog and a route map generated from the scanner would let an agent read what
exists instead of grepping — and would never lie.

## What I would do first

1. **Durable turns + boot reconciliation** (#3) — removes a live bug class we hit today.
2. **Request header in the log** (#2) — makes every future incident diagnosable.
3. **Tool output contract** (#1) — the deepest fix; it is what turns tool cards from
   "code that runs at render time" into "data with a projection".

Then the loop breaker (#4) and the smoke lane (#9), both small. The rest is worth reading
for the discipline more than for the code.

## Reading list in their repo

The following paths refer to the reviewed DeepSeek harness repository, not this Hyper checkout:

- `docs/architecture.md` — the plugin tree, seams, and where new behavior goes
- `docs/defensive-patterns.md` — one page, every rule earned by a shipped bug
- `docs/testing.md` — the tier policy, and why mocks pass while products break
- `docs/postmortem/0003-*.md` — an agent validating the wrong server; painfully familiar
- `docs/subsystems/{session,tools,compaction,spill,subagent}.md` — the contracts themselves
