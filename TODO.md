# TODO

## Top 3 critical improvements

### 1. Make `appendMessage` / `appendEvent` atomic
Current indexing appears to be based on `SELECT MAX(idx)` followed by `INSERT`, which risks race conditions under concurrent writes.

Suggested actions:
- wrap idx allocation + insert in a transaction (`BEGIN IMMEDIATE`)
- or introduce a per-agent sequence/cursor helper
- add concurrency tests for message/event append paths

Why this matters:
- preserves transcript/event integrity
- avoids PK conflicts on `(agent_id, idx)`
- protects the DB-first history model

---

### 2. Restrict dangerous `session.save()` usage
`session.save()` rewrites whole agent/message/event state and is especially risky for forked agents using lazy parent inheritance.

Suggested actions:
- add a guard for forked agents (`parentId` / `parent_id`) unless explicitly overridden
- split broad save into intent-specific APIs:
  - `saveAgentMeta(...)`
  - `saveLocalMessages(...)`
  - `saveLocalEvents(...)`
  - `updateScratchpad(...)`
- reserve full `save()` for bootstrap/test/reset flows only

Why this matters:
- protects lazy-fork semantics
- preserves DB-first source-of-truth discipline
- reduces accidental transcript corruption

---

### 3. Harden `workerLoop` / `run` crash recovery and idempotency

> **2026-08-09:** the finalize race is FIXED — claimOne consumes `next_run_at`
> atomically, runOne's finally is one atomic UPDATE (CASE-guarded cursor +
> reschedule that preserves a concurrent POST's schedule), regression test in
> `src/agent/queue.test.ts`. Remaining: stale-run lease timeout, crash-mid-cycle
> e2e tests.
The queue-driven execution path is the heart of the runtime and should be more defensive around partial failures.

Suggested actions:
- add stale-run recovery / lease timeout for `run_state = running`
- verify cursor advancement happens only after successful completion
- make tool/result emission safer across crashes
- add end-to-end tests for:
  - multiple queued user messages
  - crash before cursor advance
  - crash mid tool cycle
  - stop/abort during run
  - nested fork + queue interaction

Why this matters:
- prevents stuck agents
- avoids duplicated outputs after retries
- makes queue semantics production-safe