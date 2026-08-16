# Manual context compaction

## Goal

Add a **Compact context** button to the chat top bar. Compaction creates a hidden fork containing a Codex-style handoff summary and atomically switches the logical agent's model projection to `summary + recent verbatim tail`. The durable root transcript, URL, queue, Team identity, settings and wake-ups do not move.

This first version is manual only. Auto-compaction, tool-result microcompaction and rollback are explicitly deferred.

## Minimal storage model

Reuse the existing `agents`, `messages`, fork fields and compact `sleep_context` projection instead of introducing `agent_contexts` or routing new messages to another agent.

- Root agent remains the stable logical identity and receives all future messages/events.
- A hidden child agent is created with `parent_id = root.id`, `fork_offset = 0` and compaction metadata in scratchpad.
- The child owns one synthetic `compaction_summary` message.
- Root `sleep_context` stores a compaction generation pointing to the child and a retained suffix in the root transcript.
- `buildLlmRequest` already supports this shape: context-agent messages followed by root messages from `tailStart`.

Generation metadata should include:

```ts
{
  revision: number,
  kind: "compaction",
  status: "draft" | "active" | "stale" | "failed",
  contextAgentId: string,
  sourceAgentId: string,
  sourceOffset: number,
  sourceFrontier: number,
  tailStart: number,
  summary: string,
  instructions?: string,
  tokensBefore: number,
  tokensAfter: number,
  model: string,
  createdAt: number,
  activatedAt?: number
}
```

The hidden child must not appear in Team or navigation. Mark it with `scratchpad.compaction` rather than delegation metadata.

## Effective context

After activation the model receives:

```text
current bootstrap/system/runtime prompt
compaction summary message from hidden child
root transcript from tailStart onward, verbatim
```

The user-facing transcript remains unchanged and receives only a `compaction_completed` event/card.

Repeated compaction summarizes the **current effective projection**, not the entire physical root transcript. Existing active compact projection therefore becomes the summarizer input together with its retained root tail.

## Safe retained tail

Target approximately 30k tokens, capped at 40k, with at least five text-bearing messages when available. A rough character/token estimate is acceptable for v1.

Choose the boundary while preserving native tool protocol:

- never start at a `role="tool"` result;
- never leave an assistant `tool_calls` message without all corresponding results;
- move the cut backward until the boundary is outside a call/result group;
- validate final projection with `session.repairToolPairs` or an equivalent non-mutating pairing check.

If there is not enough removable history, return `not_needed` and do not create/activate a generation.

## Summarizer

Use `llm.call` without tools, passing the agent model and stable session ID, with a Codex-style handoff prompt:

```text
Create a concise continuation checkpoint for another coding agent.
Include current goal, progress, decisions and rationale, constraints,
rejected approaches, files changed/read, errors, unresolved issues,
exact identifiers/paths/references, and clear next steps.
Recent messages after this summary will be preserved verbatim.
Do not repeat runtime/system instructions. Do not continue the task.
```

Optional user instructions from the Compact popup are appended as focus instructions. Reject empty summary output.

## Transactional activation

1. Require root `run_state = idle` and no compaction already running.
2. Resolve the current effective model projection.
3. Snapshot root message frontier and current active compact revision.
4. Choose safe `tailStart`.
5. Create hidden draft child and run summarizer outside a DB transaction.
6. Persist summary on hidden child.
7. CAS activation only if:
   - root is still idle;
   - root message frontier is unchanged;
   - active compact revision/head is unchanged.
8. On CAS failure mark draft `stale`; old projection remains active.
9. On summarizer/cancel failure mark draft `failed`; old projection remains active.
10. On success append `compaction_completed` event with token/message metrics.

No destructive message replacement is allowed.

## Runtime API

```ts
agent.compactContext({
  agent,
  instructions?: string,
})
```

Return:

```ts
{
  status: "compacted" | "not_needed" | "stale",
  revision?: number,
  tokensBefore: number,
  tokensAfter?: number,
  keptMessages?: number,
  summary?: string
}
```

Keep legacy `agent.compact` unchanged in the first PR.

## UI

Add a button in `src/ui/chatColumn.ts` beside Sleep / Initial Prompt / Fork:

```text
Compact context
```

It opens a small popup/form with optional focus instructions and a Compact submit button. Route:

```text
POST /agent/:id/compact
```

Disable/reject while the root is running. Show lifecycle events:

- `compaction_start`: spinner/card, optional cancellation later;
- `compaction_completed`: `124k → 31k`, retained message count, expandable summary;
- `compaction_failed`: context unchanged;
- `not_needed`: concise notification.

V1 may use an HTMX form and synchronous POST if it remains safe; do not inject a normal user message to trigger compaction.

## Tests required

1. Successful compaction produces `summary + verbatim tail` in `buildLlmRequest` while root messages remain unchanged.
2. Tail selection does not split assistant tool calls from tool results.
3. A root message arriving during summarization causes CAS failure/stale draft and leaves old projection active.
4. Summarizer failure leaves old projection active.
5. Repeated compaction summarizes the current effective projection.
6. Hidden compaction child is absent from Team/navigation.
7. Button and POST route smoke tests.
8. Restart/load preserves the active compact projection.

## Out of scope

- automatic token threshold;
- Claude-style tool-result clearing;
- semantic retrieval/artifacts;
- rollback after new messages;
- migration of ordinary user forks;
- destructive changes to the durable transcript.
