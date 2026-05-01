# TODO: system prompt issues and improvements

## Critical: current `src/agent/SYSTEM_PROMPT.md` is partially stale

- The current system prompt no longer fully matches the actual codebase layout and runtime behavior.
- It still describes older routes / file paths / agent model in places.
- It should explicitly warn that prompt layout sections are illustrative and may lag behind the real code.
- Add a rule: when prompt/docs conflict with code, trust the code and inspect actual files before editing runtime behavior.

## Add an explicit “source of truth” rule

- `SYSTEM_PROMPT.md` should state that:
  - runtime behavior is defined by current code,
  - project-wide constraints are also injected from `CLAUDE.md` / `AGENTS.md`,
  - for core behavior changes the agent must inspect actual implementations first.

## Update the mental model: this is a multi-agent runtime

- Remove the outdated single-agent framing.
- Explicitly state:
  - many agents can exist,
  - each agent is keyed by `agent.id`,
  - the current `agent` binding is only one live agent within a larger runtime,
  - operations must be scoped carefully by agent id.

## Add a DB-first architecture section

Make this mandatory, not advisory:

- The database is the source of truth for transcript and event history.
- `agent.messages` and `agent.events` are synchronized runtime views, not the authoritative store.
- Do not mutate transcript/event arrays directly with:
  - `agent.messages.push(...)`
  - `agent.events.push(...)`
  - ad-hoc array edits that bypass session helpers
- Use `ctx.fns.session.append* / replace* / truncate* / delete* / updateScratchpad` helpers.
- After transcript/event DB changes, sync runtime state with:
  - `ctx.fns.session.syncAgentState(ctx, agent)`

## Add transcript visibility semantics

The system prompt should explain that persisted history and LLM-visible history are not identical.

- Messages may be marked `excluded_from_llm`.
- `ctx.fns.session.getMessages(...)` hides excluded rows by default.
- Failed eval attempts may remain persisted but be excluded from future LLM context.
- When inspecting/debugging transcript issues, distinguish:
  - all persisted messages,
  - runtime synchronized messages,
  - LLM-visible messages.

## Add fork semantics explicitly

The prompt should describe the real fork model:

- Forks store `parent_id` and `fork_offset`.
- Child transcripts are assembled lazily from the parent chain.
- `ctx.fns.session.getFullMessages(ctx, agent.id)` is the correct mental model for inherited history.
- For nested forks, offsets are based on the parent’s full inherited transcript, not only the parent’s local rows.
- Do not implement forks by eagerly copying full parent transcripts unless that is an intentional architecture change.

## Add queue / worker execution model

The prompt should explain that turn execution is queue-driven, not just synchronous request-driven.

- Agents are scheduled and drained by a worker loop.
- One run may cover multiple user messages.
- Runtime state like pending/running/idle is managed in the DB.
- Do not assume an HTTP route directly performs the full agent lifecycle inline.
- Changes to run orchestration must preserve worker semantics, frontier/cursor handling, and retry behavior.

## Add protocol-awareness: tool-calls and markers

The current prompt focuses on `evalCode`, but the runtime supports two execution protocols.

- Default protocol is tool-calls.
- There is also a markers protocol (`runMarkers`, `SYSTEM_PROMPT_MARKERS.md`).
- Protocol may be selected via scratchpad/settings.
- When changing agent run-loop / transcript / prompt behavior, verify both protocols still work.
- Do not hardcode assumptions from one protocol into shared runtime changes.

## Clarify the real `evalCode` execution contract

The prompt should match `src/repl/eval.ts` exactly.

- Code is executed as the body of an async function.
- Output shown to the user comes from:
  - `console.log(...)`
  - `console.error(...)`
  - `print(...)`
- If nothing is logged, the result is `"(no output)"`.
- Returning a value by itself does not produce user-visible output unless logged.
- TypeScript syntax is supported because code is transpiled before execution.

## Add a strict reload checklist

The prompt should contain an operational checklist:

- Changed a runtime function file:
  - reload via `ctx.fns.repl.load(ctx, "...")`
- Changed types:
  - run `ctx.genTypes(ctx)`
- Changed routes or `$script_*` files:
  - run `ctx.fns.http.loadRoutes(ctx)`
- Changed prompt files:
  - ensure the relevant agent/session actually picks up the new prompt
- Do not stop at “file written”; verify the runtime has loaded the new behavior.

## Add a runtime verification checklist

The prompt should require verification after edits.

- Check actual runtime behavior, not only file contents.
- For UI/script changes, verify the actually served HTTP asset/output.
- For runtime/session/orchestration changes, verify behavior through the live system.
- When relevant, run tests and type-checks instead of assuming the change is correct.

## Add guidance about `session.save(...)`

The prompt should explain that `session.save(...)` is not the preferred primitive for incremental transcript mutation.

- `session.save(...)` rewrites whole agent/message/event state.
- Prefer append/replace/truncate/delete helpers for transcript/event changes.
- Use `session.save(...)` when persisting whole-agent state is intentionally appropriate.
- Avoid using `session.save(...)` as the default way to append one message/event.

## Add scratchpad guidance

The prompt should better distinguish scratchpad from settings.

- `agent.scratchpad` is persistent and can influence runtime behavior.
- It is appropriate for caches, large intermediate data, plans, and task-local coordination data.
- Settings are often better for durable configurable knobs that should outlive one agent-specific workflow.
- After modifying scratchpad, persist appropriately via existing helpers when needed.

## Add delegated-task awareness

The runtime supports child-agent task delegation; the prompt should mention this.

- There are parent/child workflows in the agent runtime.
- Some scratchpad state is coordination metadata, not just memoized data.
- If changing orchestration or agent lifecycle, do not assume every agent is an isolated top-level session.

## Add “find the real file first” editing guidance

Because file names and routes in the prompt can become stale:

- Before editing a route/handler, locate the actual current file in `src/agent/`, `src/session/`, etc.
- Do not rely only on a hardcoded path mentioned in the prompt.
- For route work, inspect the actual scanned route files.
- For loader behavior, inspect `project.scan`, `loadFns`, and `loadRoutes`.

## Add test-awareness guidance

The prompt should nudge the agent to use existing tests as architectural documentation.

- Before changing queue/fork/db-first/prompt protocol behavior, inspect relevant tests.
- Existing tests encode invariants and expected semantics.
- For LLM behavior in tests, only the mock backend should be used.

## Suggested cleanup of outdated content

Revise or remove sections that currently risk misleading the agent:

- outdated route examples
- outdated single-agent assumptions
- incomplete provider/backend tables if they imply exhaustiveness
- layout details that no longer reflect current runtime structure

## High-level rewrite goal for `SYSTEM_PROMPT.md`

The prompt should remain concise, but it must accurately encode these invariants:

- one tool in normal mode: `evalCode`
- readable multi-line tool code
- code may evolve faster than prompt prose
- DB-first transcript/event model
- multi-agent runtime
- queue/worker execution model
- forked transcript semantics
- transcript exclusion semantics
- dual protocol awareness
- reload + verification discipline
- trust code over stale docs when they diverge