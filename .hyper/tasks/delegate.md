# delegateTask / finishTask implementation design

## Objective
Implement a subagent-style delegation primitive that behaves like a tool call by default, while still allowing optional inherited-context execution.

This is **not** mainly a UI/session fork feature.
It is an **agent orchestration primitive**.

The parent should be able to:
- delegate a focused task to a child agent
- choose whether the child inherits transcript context
- control task-specific instructions and output contract
- await the child synchronously by default
- optionally support async/background mode later

The child should be able to:
- complete the delegated task explicitly
- produce a structured result
- hand the result back to the parent safely
- avoid dumping its whole transcript into the parent transcript

---

# High-level design

We implement two main functions in src/agent/:
- delegateTask.ts
- finishTask.ts

Optional helpers can be added only if needed.

---

# Terminology

## Parent agent
The currently running agent that delegates work.

## Child agent
A separate agent instance created for one delegated task.

## Delegated task
A unit of work assigned by parent to child.

## Await mode
Parent blocks and waits for child completion before continuing.
This should be the default.

## Async mode
Parent starts child and returns immediately; child reports back later.
This is secondary and can be deferred.

## forkContext
Boolean flag controlling whether child inherits parent transcript context.

---

# Public API

## ctx.fns.agent.delegateTask(ctx, parentAgent, opts)

Suggested signature:

- task: string
- forkContext?: boolean
- instructions?: string
- mode?: "await" | "async"
- responseFormat?: "text" | "json" | "report" | { kind: "report" | "json"; fields?: string[] }
- model?: string
- systemPrompt?: string
- tools?: any[]

Return for await mode:
- childId
- summary
- result

Return for async mode:
- childId
- started: true

### Initial version constraints
For v1, support only:
- task
- forkContext
- instructions
- mode (default await)
- responseFormat

Ignore custom tools/model/systemPrompt until the main path is stable if needed.

---

## ctx.fns.agent.finishTask(ctx, agent, payload)

Suggested payload:
- summary: string
- result?: any
- wakeParent?: boolean

Return:
- ok: true
- parentId: string | null
- summary: string

---

# Data model

We need metadata on the child agent so finishTask() knows:
- who the parent is
- whether this child is a delegated task
- whether parent is awaiting completion
- what output contract was requested

## Recommended storage location
Use agent.scratchpad because:
- it persists with sessions already
- it does not enter model transcript
- it is easy to evolve

Suggested shape:

agent.scratchpad.delegateTask = {
  parentId: string,
  mode: "await" | "async",
  forkContext: boolean,
  task: string,
  instructions: string,
  responseFormat: any,
  status: "running" | "finished",
  result?: {
    summary: string,
    result?: any,
    finishedAt: number,
  },
}

For await-mode we also need an in-memory waiter mechanism.
Do not persist waiters themselves.

Use runtime-only memory in ctx.state, for example:

ctx.state.delegateTaskWaiters = Map childId -> { resolve, reject }

---

# Prompt construction for the child

We should not just pass task naked.
We need a task wrapper that tells the child:
- you are a delegated worker
- do not branch further unless explicitly allowed
- do not chatter
- finish by calling finishTask(...)
- return structured result

## Child task prompt template

Suggested template:

You are executing a delegated task for a parent agent.

Rules:
- Stay strictly within the assigned task.
- Do not ask the user questions.
- Do not fork/delegate further unless explicitly instructed.
- Keep your work focused and concise.
- When done, call finishTask(ctx, agent, ...) via evalCode.
- Do not dump large raw outputs into the transcript if a concise summary is enough.

Task:
<task>

Additional instructions:
<instructions>

Required response contract:
<response contract description>

For report mode, ask for fields like:
- scope
- result
- files
- issues
plus a short parent-facing summary.

---

# Context inheritance semantics

## forkContext: true
Child should inherit parent full transcript semantics.
Implementation:
- create child using current parent/child session mechanism
- child should have parent linkage to inherited transcript
- child run should therefore see inherited parent transcript through existing session machinery
- use existing session.fork(ctx, parent.id) if it already captures offset correctly

## forkContext: false
Child should start fresh.
Implementation:
- create a new agent via agent.start(...)
- no inherited transcript linkage for model context
- but still store logical parentId inside scratchpad metadata for reporting

Important distinction:
- forkContext false still means belongs to the parent task-wise
- it just does not inherit transcript context

So task parent linkage and transcript inheritance must be treated separately.

---

# Await-mode execution flow

This is the primary path.

## Parent-side algorithm in delegateTask

1. Validate opts.task is non-empty.
2. Normalize options:
   - mode = opts.mode ?? await
   - forkContext = !!opts.forkContext
   - normalize instructions
   - normalize responseFormat
3. Create child agent:
   - if forkContext true: use session.fork(ctx, parent.id)
   - else: use agent.start(ctx, ...)
4. Ensure child is registered in ctx.state.agent[child.id].
5. Attach delegated-task metadata into child.scratchpad.delegateTask.
6. Persist child session if scratchpad changed.
7. Build task prompt user message.
8. If mode is await:
   - create waiter promise
   - store resolve/reject in ctx.state.delegateTaskWaiters keyed by child.id
9. Start child execution:
   - call agent.run(ctx, child, taskPrompt)
   - either in a microtask or directly awaited depending on implementation convenience
10. In await mode, wait for waiter promise.
11. Return compact result: childId, summary, result.

## Why use waiter map
Because finishTask() may be called from tool execution inside the child turn, and it is the natural place to produce the final structured handoff.

---

# Child-side completion flow in finishTask

Algorithm:

1. Read agent.scratchpad.delegateTask.
2. Validate that metadata exists; if not, throw clear error.
3. Normalize payload:
   - require non-empty summary
   - result ?? null
4. Write result into scratchpad metadata:
   - status = finished
   - result = { summary, result, finishedAt: Date.now() }
5. Persist session if needed.
6. If mode is await:
   - look up waiter in ctx.state.delegateTaskWaiters
   - resolve waiter with { childId, summary, result }
   - delete waiter entry
7. If mode is async and parent exists:
   - append a compact synthetic parent message or event later
8. Return { ok: true, parentId, summary }.

---

# How the child should actually stop

Simplest v1 convention:
- child calls finishTask(ctx, agent, ...)
- then returns a sentinel string from evalCode if desired
- parent-side delegateTask treats waiter resolution as authoritative output

Do not over-engineer shutdown semantics in v1.
The parent should trust the waiter result and ignore any extra chatter after completion if necessary.

---

# Parent-side transcript policy

Do not inject the full child transcript into the parent transcript.

Only pass back:
- short summary
- structured result
- maybe files changed
- maybe commit hash

This preserves context economy.

A good synthetic parent-facing note could look like:
[subtask complete: childId]
Task: ...
Summary: ...
Files changed: ...
Issues: ...

---

# Async mode design (secondary)

Async mode can be implemented after awaited mode is stable.

Behavior:
- delegateTask(..., { mode: async }) returns immediately with childId and started true
- finishTask() records child result
- optionally appends synthetic message/event to parent
- optional automatic parent wake-up can be added later, but do not make it part of v1

---

# Response format normalization

Implement helper logic in delegateTask.

## Preset: text
Child should produce a short summary string and optional text result.

## Preset: json
Child should produce a short summary string and JSON-compatible result.

## Preset: report
Child should produce a short summary string and structured object like:
- scope
- result
- files
- issues

## Structured custom contract
If object form is used:
- generate child instructions from it
- do not overbuild schema validation in v1
- just tell the child which fields are expected

---

# Recommended file layout

Minimum implementation:
- src/agent/delegateTask.ts
- src/agent/finishTask.ts

Optional helpers:
- src/agent/buildDelegatedTaskPrompt.ts
- src/agent/normalizeResponseFormat.ts

---

# Test plan

## src/agent/delegateTask.test.ts
Cover:
1. forkContext true -> child linked to parent transcript context
2. forkContext false -> child isolated from parent transcript context
3. mode await -> parent receives resolved childId/summary/result
4. task metadata stored in child scratchpad
5. compact parent-facing return value

## src/agent/finishTask.test.ts
Cover:
1. child with task metadata can finish successfully
2. result saved into scratchpad metadata
3. waiter resolves in await mode
4. missing delegateTask metadata throws
5. summary required

## Optional integration test
Mock flow where:
- parent delegates task
- child calls finishTask
- parent gets awaited result

This can be tested without real LLM by mocking agent.run or llm.stream.

---

# Failure modes to handle

## Parent delegates while child cannot be created
Throw clearly.

## Child calls finishTask() without delegate metadata
Throw clearly.

## Await waiter missing
Still persist result; return ok, but note waiter absent if useful.
Do not lose data.

## Parent busy in async wake-up mode
Do not force recursion in v1.
Just record result and maybe emit event.

---

# Suggested v1 scope

Implement only:
- delegateTask(..., mode await)
- finishTask(...)
- forkContext true/false
- task prompt wrapping
- scratchpad task metadata
- waiter map in ctx.state
- tests

Do not overbuild:
- full async orchestration
- UI dashboards
- recursive delegate chains
- strict schema validators

---

# Summary recommendation

Implement delegateTask() as the parent orchestration primitive and finishTask() as the child completion primitive.

Use:
- forkContext to control transcript inheritance
- instructions for task-specific rules
- responseFormat for output contract
- mode await as the default and primary path

Internally reuse current session/agent machinery where possible, but expose this as a delegation API rather than as generic session forking.
