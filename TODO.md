# TODO: microcompact for hyper-code2

## Goal
Reduce transcript growth without full compaction. Target the main context killers we saw in agent_49e15224:
- large tool results (stdout, test output, file dumps, transcript dumps)
- large assistant tool_calls (especially evalCode arguments containing full source blobs)
- repeated medium-size tool traces that accumulate across many turns

## Design principles
- Preserve API validity: do not break assistant(tool_calls) -> tool(tool_call_id) pairing.
- Prefer local surgery over whole-session summarization.
- Keep recent work verbatim; compact older tool-heavy spans first.
- Store any recoverable large payload outside the LLM-visible transcript when possible.
- Make microcompact cheap enough to run often.

## Strategy set

### Strategy A: Clear old tool results in place
Inspired by claude-code microcompact.
- Scan messages from oldest to newest.
- Find role='tool' messages whose content is above threshold, or total cumulative tool bytes exceed threshold.
- Keep the last N tool results untouched.
- Replace older tool content with a short stub, e.g.:
  - "[tool result compacted: bun test output, 68717 chars, status=0; see scratchpad/archive if needed]"
- Optionally archive original content into:
  - agent.scratchpad.microcompact.archive[messageIndex]
  - or a DB table / file under .hyper/

Why: in our session, tool messages were the biggest cost (~595 KB total).

### Strategy B: Shrink assistant tool_calls arguments
This is especially important for our system because evalCode arguments often contain huge inline JS strings.
- Find assistant messages with tool_calls.
- For old ones, replace tool_calls JSON with a reduced representation that preserves:
  - tool call id
  - function name
  - tiny summary of arguments
- Example reduced shape:
  - original: full evalCode arguments with 10KB code string
  - compacted: { id, type, function: { name: 'evalCode', arguments: '{"code":"[compacted; wrote src/x.ts, ~180 lines]"}' } }
- Must only compact calls whose matching tool result is already present and old enough.
- Never compact the freshest unresolved tool call chain.

Why: in our session assistant tool_calls alone cost ~347 KB, much of it raw code blobs.

### Strategy C: Fork-and-summarize rollback
Your idea; useful for aggressive microcompact when a message is already too big.
- If a fresh tool result exceeds threshold, fork a helper summarizer agent/session.
- Give it only the oversized payload plus task: produce a short factual summary preserving key facts.
- Replace original oversized transcript segment with summary.
- Roll back to the pre-large-message point if needed and insert the summary as synthetic user/tool note.

Possible flow:
1. tool returns huge payload
2. helper summarizes
3. parent replaces tool content or compacts from assistant/tool pair start
4. original huge payload stored in archive/scratchpad/file

This is safer than asking the main agent to summarize while already paying the context cost for many future turns.

### Strategy D: Shape-first auto-return policy
Prevent growth before it happens.
- Wrap evalCode results through a normalizer:
  - strings > X chars => summarize/truncate
  - arrays > Y items => return len + sample
  - objects with huge nested fields => return keys + selected fields
- Encourage scratchpad/archive storage for full payloads.
- Good for stdout, file reads, test logs, DB dumps.

This is prevention, not cleanup.

### Strategy E: Round-based compacting
Compact whole assistant/tool neighborhoods rather than single messages.
- Group: assistant(tool_calls) + following tool result(s)
- Replace old groups with one compact synthetic note
- Better semantic preservation than independently shrinking one side

Useful when a single operation had:
- huge evalCode source in assistant.tool_calls
- huge stdout in tool result

### Strategy F: Time/age based cleanup
Like claude-code's time-based microcompact, but adapted to our agent runtime.
- If session is old or there has been a long idle gap, clear older tool-heavy messages more aggressively.
- Keep last K turns intact.

### Strategy G: Budget-based cleanup before every LLM call
Before ctx.fns.agent.stream(ctx, agent):
- estimate transcript bytes/tokens
- if above threshold, run microcompact automatically
- thresholds:
  - warning threshold
  - aggressive threshold
  - blocking threshold

## Suggested implementation plan

### 1. Add transcript analysis helpers
Create .hyper/session/ helpers or .hyper/agent helpers:
- estimateMessageCost(ctx, message) -> bytes/chars by role
- findMicrocompactCandidates(ctx, agent, opts)
- groupMessageRounds(ctx, agent)

Candidate scoring factors:
- role=tool and content length
- role=assistant with tool_calls length
- age (older first)
- preserve last N rounds

### 2. Add a persistent archive for removed payloads
Options:
- scratchpad-only for quick version
- better: DB/file-backed archive

Suggested file layout:
- .hyper/microcompact/<agentId>/<timestamp>-<messageIndex>.json

Archive record:
- agentId
- messageIndex
- role
- original content/tool_calls
- summary
- ts
- strategy used

### 3. Implement first safe pass: tool-result clearing
Function idea:
- .hyper/agent/microcompactToolResults.ts
Inputs:
- agent
- keepLastToolResults = 6
- maxToolChars = 4000
- targetFreedChars = 30000
Behavior:
- archive oversized old tool contents
- replace with short summary stub
- save session

### 4. Implement second pass: assistant tool_call shrinking
Function idea:
- .hyper/agent/microcompactToolCalls.ts
Behavior:
- operate only on old resolved tool call messages
- summarize evalCode code intent from arguments
- replace huge arguments strings with short description

### 5. Implement orchestrator
Function idea:
- .hyper/agent/microcompact.ts
Behavior:
- analyze
- choose strategy A/B/E based on biggest offenders
- return report: freed chars, changed messages, archived count

### 6. Hook before model calls
Best place conceptually:
- before each ctx.fns.agent.stream(ctx, agent)
- maybe as small wrapper/helper, avoid invasive rewrite at first

Potential sequence:
1. analyze transcript size
2. if above threshold, run microcompact
3. if still too large, run normal compact

### 7. Optional fork summarizer helper
Later step.
Function idea:
- .hyper/agent/microcompactSummarizeLargeMessage.ts
Could use:
- child agent or direct model call
- input is one oversized message/group only
- output is compact factual summary

## Safety constraints
- Never leave dangling tool_call / tool result references.
- Never compact the newest unresolved tool chain.
- Preserve the most recent few user-visible turns fully.
- Always archive before destructive replacement.
- Session DB must remain source of truth after mutation.

## Recommended rollout order
1. Analysis/report only
2. Tool-result clearing
3. Assistant tool_call shrinking
4. Auto-trigger before stream
5. Fork summarizer for oversized fresh outputs

## Notes from claude-code
Relevant ideas borrowed from ~/claude-code/src/services/compact/microCompact.ts:
- microcompact is separate from full compact
- keep recent results, clear older ones
- cheap, frequent cleanup beats rare giant compaction
- can be time-based or threshold-based

## Success criteria
- large test/stdout outputs stop staying in prompt forever
- large evalCode argument blobs stop accumulating in assistant messages
- normal coding sessions survive many more turns before full compaction is needed
- transcript remains valid for next LLM call


## Additional issue: large assistant write payloads
When our agent writes files via evalCode + Bun.write(...big string...), the entire source blob is embedded in assistant.tool_calls arguments and permanently bloats transcript history.

### What claude-code does differently
Claude Code avoids this specific blow-up by using structured editing tools instead of stuffing full file contents into assistant text/tool-call JSON.

Observed design direction in claude-code:
- dedicated tools like FileWriteTool / FileEditTool
- the model sends structured tool inputs, not giant inline assistant prose dumps
- edit workflows are centered around diffs/patches/targeted edits rather than repeatedly embedding whole files into the transcript
- context management later clears old tool uses/results, so tool traces do not stay verbatim forever

Practical implication for hyper-code2:
our current single-tool evalCode model is worst-case for context growth because writing a file usually means assistant emits:
- a large evalCode call
- containing a huge JS string
- containing the full file text

So even before the tool result comes back, the assistant message is already expensive.

## New strategies for file-writing bloat

### Strategy H: Out-of-band file write helper
Add a runtime helper that lets the agent write large content without embedding it in assistant.tool_calls.
Possible pattern:
1. tool call sends only a small instruction / metadata
2. actual large content is sourced from:
   - scratchpad
   - temp file under .hyper/tmp/
   - archived blob store
3. helper writes to final destination

Example helpers:
- writeBlob(path, blobId)
- createTempBlob(content) -> blobId
- writePatch(path, patch)

Note: because the LLM only has evalCode, this still requires a workflow change: first store content out-of-band, then call a tiny helper. For agent-authored code generation, we may need a higher-level utility that internally chunks or stages content.

### Strategy I: Chunked file staging
Instead of one giant Bun.write('file', hugeText):
- append chunks into archive/temp storage
- final small call assembles and writes the file
This lowers peak assistant tool_call size per message.

### Strategy J: Diff-first editing
Prefer editing existing files via patch/diff instructions rather than full rewrites.
For our environment this could mean helper functions like:
- replaceRangeInFile(path, from, to)
- applyStringPatch(path, search, replace)
- appendFile(path, text)

This mirrors claude-code's FileEditTool direction: smaller structured edits produce much smaller transcript footprint than full-file rewrites.

### Strategy K: Post-write assistant tool_call compaction
After a large file-write operation succeeds:
- summarize the assistant tool_call as:
  - wrote .hyper/x.ts (~180 lines, exports ctx.fns.skill.todo)
- archive the original huge evalCode arguments
- replace old tool_calls payload with minimal metadata

This directly addresses our current transcript shape.

## Concrete TODO additions
- add helper APIs under .hyper/files or .hyper/agent for staged writes
- prefer append/patch helpers over full Bun.write for modifications
- teach microcompact to detect file-write evalCode calls and summarize them specially
- add a rule of thumb: if generated code > N chars, stage it outside transcript before final write
- consider a blob store under .hyper/blobs/ keyed by hash

## Priority
This is likely the single biggest assistant-side source of transcript inflation in our system, alongside large tool stdout. It should be treated as a first-class microcompact target, not an edge case.


## Concrete findings from claude-code file writing/editing
I re-read the actual implementation, not just the idea.

### FileWriteTool: why it bloats less in transcript
Source: src/tools/FileWriteTool/FileWriteTool.ts

Important details:
- The tool input schema is structured:
  - file_path
  - content
- The tool's internal return data is rich and includes:
  - content
  - structuredPatch
  - originalFile
- BUT the LLM-visible tool_result is intentionally tiny via mapToolResultToToolResultBlockParam():
  - create => "File created successfully at: ..."
  - update => "The file ... has been updated successfully."

This is a key pattern: the full data may exist for UI/runtime, but the model gets only a short textual success result.
So claude-code avoids transcript blow-up on the tool-result side after writes.

### FileEditTool: same pattern
Source: src/tools/FileEditTool/FileEditTool.ts

Important details:
- The input is structured and targeted:
  - file_path
  - old_string
  - new_string
  - replace_all
- Internally it computes patch/original/new content.
- But the LLM-visible tool_result is again tiny:
  - "The file X has been updated successfully."
  - or "All occurrences were successfully replaced."

So again: rich internal result, minimal model-visible result.

### Real difference vs our system
Our current system with evalCode is worse in two distinct ways:
1. the assistant tool_call itself contains huge inline JS and often the full file text
2. the tool result may also contain a big payload unless we manually summarize it

Claude-code only really pays for the write content once in the tool input; after execution the model gets a tiny tool_result string.
In our system we often pay twice:
- huge assistant.tool_calls JSON
- huge tool result / stdout / echo

### Extra concrete takeaway
Claude-code does NOT solve this by magically hiding FileWriteTool input from history; the tool input still exists as the assistant tool_use payload. What it does concretely is:
- prefer FileEditTool with small old/new string edits when possible
- keep tool_result minimal
- rely on later microcompact/compaction to clear old tool traces

So the exact lesson for hyper-code2 is NOT just "use a file tool".
It is:
- minimize assistant-side payload at write time
- make tool results tiny by default
- post-compact old assistant write calls aggressively

## Updated implementation implications for hyper-code2

### Rule 1: tiny tool results by default
When evalCode writes a file, returned value should be tiny, e.g.:
- { ok: true, path, action: 'create'|'update', bytes, lines }
not full content / not stdout dump.

### Rule 2: prefer patch/edit helpers over whole-file writes
We need helpers that mirror FileEditTool behavior:
- replaceStringInFile(path, oldString, newString, replaceAll?)
- appendToFile(path, text)
- writeFileSummary(path, content) returning only metadata

### Rule 3: special-case write-call compaction
Because evalCode arguments remain in assistant.tool_calls, microcompact should detect file-writing calls and rewrite old arguments summaries like:
- wrote src/foo.ts (new file, ~142 lines)
- updated src/bar.ts via targeted replacement

### Rule 4: avoid echoing content in tool results
Never return the written file body unless explicitly needed.
A successful write should look like claude-code's mapToolResultToToolResultBlockParam output: short confirmation only.

### Rule 5: prefer targeted edit APIs for existing files
This is the biggest concrete transcript win from claude-code's actual implementation.
Editing with old_string/new_string is much smaller than Bun.write(fullFile).

## Priority adjustment
File-writing bloat is actually two subproblems:
1. large assistant tool_call arguments during full-file writes
2. oversized tool results after writes

Claude-code already solves (2) directly with tiny tool_result mapping.
We should copy that first.
Then attack (1) with edit helpers + microcompact of old evalCode write calls.


## Additional strategies discussed

### External blob storage instead of transcript storage
The agent can write large content to non-transcript storage and keep only a short reference in history.

Possible stores:
- files under .hyper/blobs/
- SQLite table for blobs
- scratchpad for short-lived payloads

Pattern:
1. save large payload externally
2. return only { blobId, kind, bytes, summary }
3. later code can re-read the blob whenever needed

Important nuance:
- this keeps payload available to the agent/runtime
- but not automatically visible to the LLM
- if the model needs meaning, re-expose only a small derived summary or slice

This is a first-class answer to large generated code, stdout, dumps, and archived tool results.

### LLM read / retrieval-by-summary helper
Add a helper that reads a file/blob in an isolated context and returns only a summary tailored to a task.

Proposed API shape:
- llmRead(pathOrBlobId, task, options?) -> short summary / structured answer

Examples of tasks:
- summarize this file for later editing
- list exports and key types
- extract only migration intent
- explain what changed conceptually
- find risks / invariants / TODOs

Why this matters:
- full content can stay outside main transcript
- main agent can work mostly from summaries
- raw content is pulled into model context only in narrow specialized subcalls

### Prompt policy: cheap inspection before full read
Add a system-prompt rule / operating policy:
1. first inspect cheaply
2. then try retrieval-by-summary
3. only then read the full content if exact text is truly required

More explicit version:
- first use code to inspect shape/signals:
  - byte length
  - line count
  - top-level names
  - regex matches
  - targeted ranges
- then use llmRead/retrieval-by-summary when semantic understanding is needed
- only read/return full file when exact text is necessary for editing, quoting, or verification

This policy should apply to:
- files
- large command output
- large DB/query results
- archived blobs

### Local code inspection is preferred over shell grep
We do not need external grep tools for most cases.
Because evalCode can read files into local variables, we can:
- parse lines
- run regex
- count patterns
- extract slices
- compute summaries
without exposing the raw file to transcript.

Core rule:
- reading large content inside evalCode is cheap
- returning large content to transcript is expensive

So the preferred workflow is:
1. read into local variable
2. inspect/process locally
3. return only compact findings

### Full-file text: when it is actually needed
Clarification from discussion:
- fullFileText is often necessary for new file creation or full rewrite
- it is often NOT necessary for edits to existing files

Therefore:
- prefer targeted edit helpers for existing files
- reserve full-file payloads for genuinely new/full-rewrite cases
- compact/archive old full-write assistant calls after they are no longer needed

### New implementation priorities implied by these ideas
1. external blob/archive store
2. llmRead retrieval-by-summary helper
3. prompt rule: inspect -> summarize -> full read only if necessary
4. edit helpers for targeted modification
5. microcompact pass specialized for old file-write assistant calls

## Suggested future helper functions
- blob.put(ctx, agent, content, meta?) -> { blobId, bytes }
- blob.get(ctx, agent, blobId) -> content
- blob.stat(ctx, agent, blobId)
- agent.llmRead(ctx, agent, { path?, blobId?, task, maxOutput? })
- files.inspect(ctx, path, opts) -> small structural summary
- files.edit(ctx, path, oldString, newString, replaceAll?)
- files.writeViaBlob(ctx, path, blobId)

## Proposed system-prompt additions
- Never return full file content unless exact text is required.
- Prefer local inspection in evalCode over dumping content.
- For large files/results: inspect first, summarize second, read fully only as a last resort.
- Prefer targeted edits over full rewrites when modifying existing files.
- When generating large content, store it outside transcript and return only a short note or blob reference.


## Session analysis: where to start
I reviewed recent sessions in the same style as the earlier investigation.

### Aggregate picture
Across the recent analyzed sessions:
- sessions analyzed: 5
- total transcript payload: ~8.39 MB
- user content: ~6.5 KB
- assistant content/tool_calls: ~675 KB
- tool content: ~7.70 MB
- large tool messages (>8 KB): 43
- large assistant tool_call blobs (>8 KB): 17
- assistant calls containing Bun.write(...): 88

### Main conclusion
The first thing to fix is NOT user chat, and not normal assistant prose.
The biggest problem by far is:
1. oversized tool outputs
2. then oversized assistant tool_calls during code/file writes

Tool content is overwhelmingly dominant across sessions.

## Session-by-session patterns

### 1) agent_de543c7c — catastrophic giant tool dump
- total: ~3.92 MB
- tool: ~3.83 MB
- worst single tool message: idx 48, ~3.66 MB

This is an extreme outlier and shows the most urgent failure mode: one gigantic tool result can effectively kill the session immediately.
This kind of payload must never remain in transcript.

Action implied:
- immediate post-tool oversized-result summarization
- archive raw payload out of transcript
- hard cap on tool result size returned to history

### 2) agent_a0c45b81 — giant HTML/page dump problem
- total: ~2.60 MB
- tool: ~2.56 MB
- worst tool messages:
  - idx 46: ~2.20 MB
  - idx 34: ~336 KB

Pattern: dumping whole page / HTML / UI state blobs into tool results.

Action implied:
- shape/slice first for page inspection
- never return full HTML/page state unless explicitly requested
- use file/blob/archive + summary for captured pages

### 3) agent_49e15224 — mixed problem, most representative
- total: ~941 KB
- assistant: ~347 KB
- tool: ~591 KB
- 21 large tool messages
- 9 large assistant tool_call blobs
- 53 Bun.write-containing assistant calls

Pattern:
- repeated bun test stdout dumps
- transcript/history dumps
- many full inline file writes in evalCode arguments

This is the clearest representative of our normal engineering workflow problem.

Action implied:
- first implement tool-result microcompact
- second implement assistant write-call microcompact
- third introduce targeted edit helpers / blob staging

### 4) agent_073b96bc — source dump / test dump problem
- total: ~596 KB
- tool: ~439 KB
- assistant: ~156 KB
- worst tool message: source file dump ~182 KB
- also large failing HTML/error page and test output

Pattern:
- reading full source files into tool result
- returning failing pages/errors verbatim
- moderate file-write assistant blobs

Action implied:
- system prompt policy: inspect first, summarize second, full read last
- llmRead helper would help here

### 5) agent_8775e5c8 — analysis session, still tool-heavy
- total: ~325 KB
- tool: ~276 KB
- assistant: ~47 KB

Even an analysis-only session became tool-heavy because code/files from claude-code were returned in bulk.
This confirms the rule: even research/inspection sessions need compact-return discipline.

## Recommended starting order

### Start with #1: hard limit + summarization for oversized tool results
Why first:
- biggest source of waste across all sessions
- easiest high-leverage win
- protects against catastrophic single-message failures

Minimum policy:
- if tool result exceeds threshold, do not store raw result in transcript
- archive externally
- keep only short summary/metadata in tool message

This should be the first implementation.

### Then #2: microcompact old assistant tool_calls with Bun.write/full code blobs
Why second:
- next biggest recurring source
- especially damaging in coding sessions
- old write calls are rarely needed verbatim after success

This should summarize old evalCode write calls to short notes.

### Then #3: change generation workflow for writes/reads
Why third:
- prevents future growth instead of only cleaning after the fact

Substeps:
- targeted edit helpers for existing files
- blob staging for large generated content
- inspect-first / summarize-first read workflow
- llmRead retrieval-by-summary helper

## What NOT to start with
Do not start with:
- compacting user messages
- rewriting normal assistant prose
- sophisticated memory systems before fixing raw transcript bloat

Those are not the main problem in the observed sessions.

## Practical roadmap based on session evidence
1. hard cap tool result size in transcript
2. archive large tool payloads outside transcript
3. summarize oversized results immediately
4. microcompact old assistant Bun.write/evalCode blobs
5. add targeted file-edit helpers
6. add llmRead / retrieval-by-summary
7. update system prompt to enforce inspect -> summarize -> full read last

## Short recommendation
If we do only one thing first, it should be:
**make oversized tool results impossible to keep verbatim in transcript**.

If we do two things:
**(1) cap/summarize tool results, (2) compact old assistant file-write calls**.


## Additional strategy: self-rollback with summary
A very promising capability is letting the agent compact its own recent dead-end work proactively.

### Idea
The agent starts a line of work, spends several assistant/tool messages, then realizes:
- this branch is not useful
- it consumed too much context
- the important outcome can be expressed in 1-3 sentences

In that case the agent should be able to:
1. identify the rollback point
2. summarize what was tried / learned / failed
3. delete the noisy suffix of transcript
4. replace it with one compact synthetic note

This is more powerful than ordinary microcompact because it removes an entire exploratory branch, not just large payloads.

### Existing primitive we already have
We already have a strong primitive for this:
- ctx.fns.agent.compact(ctx, agent, { message, summary })

This means the missing piece is mostly policy + automation, not low-level capability.

### When self-rollback should trigger
Possible triggers:
- a branch produced several large tool outputs but no durable progress
- repeated failed tool calls
- exploratory reads/searches that turned out irrelevant
- generated code path was abandoned
- the agent notices that the latest N messages can be summarized much more cheaply

### Recommended policy
Teach the agent/runtime:
- if a branch is clearly a dead end, compact it immediately
- prefer rolling back to the branch start, not only compacting one large message
- summary should preserve:
  - intent
  - what was attempted
  - why it failed / was abandoned
  - what to do next instead

Example synthetic summary note:
- tried regex-based patching for session save flow; abandoned because message/tool pairing invariants made it unsafe; switching to DB-first helper approach

### Future automation helper
Potential helper:
- agent.rollbackRecent(ctx, agent, opts)
Inputs might include:
- fromMessage / lastNRounds / heuristic mode
- summary
- maybe archive=true

## Additional strategy: automatic error analysis on failed tool calls
Another high-value path is to treat tool errors as compaction opportunities.

### Idea
When a tool call fails, raw error text often stays in transcript and the agent then spends more messages re-reading it.
Instead we should immediately derive a compact error explanation.

### Desired flow
1. tool call fails
2. capture raw error externally if needed
3. analyze the error right away
4. write a short structured note into transcript:
   - what command/code was trying to do
   - root cause / likely cause
   - actionable fix
5. optionally compact the raw failing result

### Why this helps
Error payloads are often noisy:
- stack traces
- repeated test runner output
- HTML error pages
- permission/path/runtime errors with lots of boilerplate

What the future model really needs is usually only:
- cause
- affected file/path/tool
- next action

### Suggested summary format for failed tool calls
- Tool failed: Bun.write to src/x.ts
- Cause: syntax error in generated template string near line 14
- Fix: escape backticks/newlines or write content via array join/blob staging

Or:
- Tool failed: bun test
- Cause: 3 tests failing in session fork logic; nested fork offset computed from local count instead of inherited full transcript length
- Fix: compute offsets from full inherited transcript

### Implementation ideas
- post-process tool errors before persisting full payload into transcript
- add error analyzer helper for stdout/stderr/exception objects
- special-case common failures:
  - syntax error
  - ENOENT
  - permission denied
  - test failures
  - HTTP 500/HTML error page
  - JSON parse errors

### Priority relative to other work
This should come after hard-capping oversized successful tool results, but it is likely higher value than many advanced memory features.
Because failures are both common and disproportionately noisy.

## Updated prioritization
1. hard cap + summarize oversized tool results
2. compact/summary old assistant file-write calls
3. self-rollback with summary for dead-end branches
4. immediate compact error analysis for failed tool calls
5. targeted edit helpers / blob staging
6. llmRead / retrieval-by-summary
7. prompt policy improvements


## Important principle: written files do not need to stay in transcript
After a file has been successfully created or updated, the full written content does NOT need to remain in the LLM-visible transcript.

Why:
- the file on disk is now the source of truth
- the agent can always re-read it later
- keeping the original full write payload in assistant.tool_calls is redundant context storage

This is especially important for our evalCode-based workflow, where a successful write often leaves behind a huge assistant call containing fullFileText.

### Practical rule
For successful file writes/updates:
- keep only compact metadata in transcript, such as:
  - wrote src/x.ts (~180 lines)
  - updated src/y.ts; changed session save flow
- archive or discard the original huge assistant write payload once it is no longer needed for immediate continuity
- if exact content is needed later, re-read from disk rather than preserving the original generation blob in context

### Implication for microcompact
Successful file-write/file-edit operations should be first-class microcompact targets.
They are unusually safe to compact because:
- content is recoverable from disk
- semantic outcome is easy to summarize
- old exact payload is rarely needed verbatim after success

### Priority note
This strengthens the case for an early specialized pass:
- detect successful Bun.write / file-edit style operations
- replace old assistant/tool traces with short notes
- rely on filesystem re-read if details are needed later


## Important principle: operations on large files should go through a subagent/fork
When a task involves a large file, the main agent should avoid pulling the whole file or all intermediate reasoning into its own transcript.
Instead, manipulation/inspection should be delegated to a subagent (fork) whenever feasible.

### Why
- large-file work creates many expensive intermediate reads/searches/summaries
- the main transcript should only keep the compact outcome
- forks are a natural isolation boundary for context-heavy local work

### Recommended pattern
1. main agent detects large-file task
2. fork/subagent handles:
   - reading
   - searching
   - slicing
   - summarizing
   - even preparing an edit plan
3. parent keeps only the returned summary / result / action item
4. if exact text is needed later, re-read from disk or rerun a focused fork

### Good use cases
- analyzing a long source file
- understanding a generated artifact
- mining a huge test log
- extracting structure from large HTML/JSON
- planning edits in a large file before applying them

### Prompt / policy implication
Main agent should prefer:
- cheap local inspection first
- then subagent for large-file semantic work
- only direct full-file main-context handling as a last resort

### Priority implication
This is a prevention strategy for context blow-up and pairs well with:
- llmRead / retrieval-by-summary
- blob/archive storage
- self-rollback on exploratory branches
