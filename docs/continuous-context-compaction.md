# Context tree: continuous growth, folding and retrieval

**Status:** conceptual design; not implemented.

## 1. Goal

Replace periodic whole-conversation summarization with a **context tree** that grows with the work and folds completed branches into nested capsules.

The durable root transcript remains immutable and authoritative. Folding creates derived projections over messages, child agents and artifacts; it never makes raw history unrecoverable.

The central hierarchy is a tree rather than a flat transcript:

```text
session root
├── track
│   └── goal
│       ├── task
│       │   ├── episode
│       │   ├── episode
│       │   └── independent subtask
│       │       ├── child task / episode
│       │       └── child task / episode
│       └── task
└── track
    └── goal
        └── task
```

The tree continuously alternates between two operations:

```text
grow:  instruction / action / observation → new nodes and leaves
fold:  completed children → parent capsule with child and raw references
```

Work happens on expanded active leaves. Finished branches remain durable but are represented in the normal model context by progressively smaller capsules. A relevant branch can later be unfolded to child capsules or raw evidence.

The next LLM request should not receive one undifferentiated transcript. It should receive a budgeted tree projection assembled from:

```text
pinned invariants
+ path from session root to active leaf
+ expanded active sibling branches and open loops
+ folded capsules of relevant completed branches
+ retrieved child capsules or raw evidence
+ recent verbatim tail
```

## 2. Motivation

A long agent session commonly contains several weakly related tracks. In the observed `wrm` session, four major tracks occupied roughly 161k estimated tokens:

1. stale-run diagnosis and lease repair — about 53k;
2. TypeScript cleanup and release work — about 26k;
3. Chrome multi-tab/SSE freeze — about 32k;
4. context compaction research and design — about 53k.

Only the fourth track remained active. The other three could have been represented by compact completion capsules and retrieved from raw history only if mentioned again.

Most physical context was not user intent. Tool results and tool-call arguments occupied roughly 93% of the transcript payload. Therefore the primary unit of compaction should be a completed work episode, not arbitrary old messages.

## 3. Design principles

### 3.1 Raw transcript is immutable truth

Messages, tool calls and tool results remain in Postgres. Derived memory always carries provenance back to raw message indices and artifacts.

### 3.2 Summary is a projection, not memory truth

An LLM-generated summary may omit or distort information. It can guide retrieval and context selection, but must not be the only surviving representation of facts, constraints or evidence.

### 3.3 Compact semantic units, not token intervals

Token pressure triggers analysis, but boundaries should follow semantic units:

- a track switch;
- a completed task;
- an independent subtask returning a result;
- a coherent tool episode;
- an explicit decision or checkpoint.

### 3.4 Active and closed state are different

Active work remains detailed. Closed work becomes a capsule. A closed capsule can be reopened when the user returns to that track.

### 3.5 Critical state is pinned or structured

The summarizer must not decide whether to retain:

- runtime and safety rules;
- explicit user constraints;
- current workspace and permissions;
- active goal and acceptance criteria;
- unresolved side effects;
- active plan and open tasks.

These are injected from authoritative structured state.


### 3.6 Context is a growing and folding tree

The model is not “a transcript that occasionally gets shorter”. It is a durable execution tree whose visible resolution changes over time.

- New user goals grow tracks and goals.
- Plans grow tasks.
- Tool cycles grow episodes, observations and artifacts.
- Delegation grows a child-agent subtree.
- Completion folds a branch into a capsule.
- Relevance unfolds only the detail required for the next decision.

Folding changes the context projection, not the underlying history or lineage.

### 3.7 Capsules form a matryoshka

A capsule may contain references to child capsules, which may themselves contain lower-level capsules:

```text
track capsule
├── goal capsule
│   ├── task capsule
│   │   ├── episode capsule
│   │   └── subtask capsule
│   │       ├── research episode capsule
│   │       └── verification episode capsule
│   └── task capsule
└── raw provenance
```

A parent capsule must not be an irreversible free-form re-summary of its children. It stores a concise parent-level outcome plus stable `childIds`, source ranges and evidence references. Every important claim is traceable downward.

### 3.8 Fold is not prune

These operations have different semantics:

- **Fold** creates or updates a capsule for a completed branch and uses it instead of expanded descendants.
- **Unfold** adds selected descendants or raw evidence to the current projection.
- **Prune** excludes an irrelevant branch from one request without changing its stored fold state.
- **Graft** changes or adds a relationship when a task belongs to another track or several goals.
- **Supersede** records that a newer branch replaces an older conclusion while preserving history.

Only the request projection is pruned. Durable nodes are never silently deleted.

## 4. Terminology

### Goal

A desired user-visible outcome with completion criteria. A goal may span several tracks, though the common case is one goal per track.

Examples:

- prevent false stale-run recovery;
- stop Hyper UI freezing with multiple tabs;
- design continuous context compaction.

### Track

A coherent line of work inside one session. A track groups instructions, decisions, tasks and evidence that are strongly related to one outcome.

A new track is suggested when a user introduces a new objective with low semantic and dependency overlap with the active track. Short commands such as “test it”, “commit”, or “push” normally continue the current track rather than create a new one.

Track states:

```text
proposed → active → paused → closed
                    ↘ superseded
```

Only one track is foreground by default; multiple tracks may remain active when the user explicitly interleaves work.

### Task

A bounded unit of work inside a track. A task has an expected result and completion evidence. Existing `session.plan` tasks are an explicit source of task boundaries, but tasks may also be inferred when no plan exists.

### Episode

A contiguous execution segment that can be understood as one local action and outcome. Typical episodes are:

- inspect several related files and reach a conclusion;
- make one coherent edit and verify it;
- reproduce a bug;
- research one question;
- run tests and interpret failures.

Episodes are the input to micro-compaction.

### Independent subtask

A large, internally coherent task whose intermediate transcript is not needed by the parent once a result is available. Semantically it behaves like a delegated subagent even if it was executed inline in the root agent.

Examples:

- inspect three external repositories and compare their implementations;
- diagnose all TypeScript errors in a plugin;
- reproduce a browser failure across eight tabs;
- perform a literature search and synthesize recommendations.

Its output is a **subtask capsule**: a bounded result packet with provenance, artifacts and follow-up handles.


### Context tree node

Every semantic unit is a node in one durable tree or DAG-like extension of it. The initial implementation should prefer a strict tree and use explicit cross-links where one artifact or decision belongs to several branches.

```ts
type ContextNode = {
  id: string;
  agentId: string;
  kind: "session" | "track" | "goal" | "task" | "subtask" | "episode";
  parentId: string | null;
  childIds: string[];
  status: "proposed" | "active" | "paused" | "done" | "blocked" | "failed" | "superseded";
  foldState: "expanded" | "folded";
  objective?: string;
  source: {
    agentIds: string[];
    messageRanges: Array<{ agentId: string; fromIdx: number; toIdx: number }>;
  };
  capsuleId?: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
};
```

The active context is primarily the path from root to one or more active leaves. Completed side branches are folded unless retrieval marks them relevant.


## 5. Memory products

### 5.1 Micro-summary

Generated continuously for one completed episode. It should be small, factual and source-linked.

```ts
type EpisodeSummary = {
  id: string;
  trackId: string;
  taskId?: string;
  range: { fromIdx: number; toIdx: number };
  status: "active" | "closed" | "superseded" | "stale";
  outcome: string;
  decisions: Array<{
    text: string;
    rationale?: string;
    refs: number[];
  }>;
  facts: Array<{
    text: string;
    refs: number[];
  }>;
  artifacts: Array<{
    kind: "file" | "commit" | "url" | "db-row" | "test" | "agent" | "other";
    value: string;
    refs: number[];
  }>;
  openLoops: Array<{
    text: string;
    refs: number[];
  }>;
  errors: Array<{
    text: string;
    resolution?: string;
    refs: number[];
  }>;
  createdAt: number;
  model: string;
};
```

A micro-summary does not rewrite prior summaries. Corrections and supersession are explicit relations.

### 5.2 Task capsule

Produced when a task closes. It combines its episode summaries and authoritative plan state.

```ts
type TaskCapsule = {
  id: string;
  trackId: string;
  title: string;
  objective: string;
  status: "done" | "blocked" | "failed" | "cancelled";
  result: unknown;
  summary: string;
  acceptanceEvidence: Array<{ text: string; refs: number[] }>;
  decisions: Array<{ text: string; refs: number[] }>;
  artifacts: Array<{ kind: string; value: string; refs: number[] }>;
  unresolved: Array<{ text: string; refs: number[] }>;
  rawRange: { fromIdx: number; toIdx: number };
  childAgentId?: string;
};
```

### 5.3 Independent subtask capsule

This is the preferred representation for a large independent subtask. It mirrors `agent.finishTask({ summary, result })`:

```text
bounded task packet in
separate/noisy execution transcript
structured result + concise summary out
```

If work runs in a delegated child, the child transcript is already physically isolated. The parent stores only the team update and task result. If work ran inline, the compactor may retrospectively identify its message range and project it exactly as if it had been delegated.

The capsule must preserve:

- objective and scope;
- final result;
- decisions and rationale;
- acceptance/test evidence;
- durable artifacts and identifiers;
- unresolved issues;
- raw range or child-agent reference;
- a handle for follow-up retrieval.

It should discard from the active projection:

- repeated searches;
- exploratory reads whose conclusion is recorded;
- verbose test output after the verdict is captured;
- intermediate tool errors that were resolved;
- mechanical command arguments.

### 5.4 Track capsule

Produced when a track closes or is paused for long enough.

```ts
type TrackCapsule = {
  id: string;
  title: string;
  goal: string;
  status: "paused" | "closed" | "superseded";
  summary: string;
  taskCapsuleIds: string[];
  finalState: Record<string, unknown>;
  decisions: Array<{ text: string; refs: number[] }>;
  artifacts: Array<{ kind: string; value: string; refs: number[] }>;
  unresolved: Array<{ text: string; refs: number[] }>;
  range: { fromIdx: number; toIdx: number };
  closedAt?: number;
};
```

Closed track capsules are not injected by default. They are retrieved when the new instruction refers to their goal, artifacts, files, errors or identifiers.



### 5.5 Generic nested capsule

Episode, task and track capsules share one recursive envelope. Specialized payloads remain useful, but the common shape enables tree folding and progressive disclosure.

```ts
type Capsule = {
  id: string;
  nodeId: string;
  kind: "episode" | "subtask" | "task" | "goal" | "track";
  parentCapsuleId?: string;
  childCapsuleIds: string[];

  objective: string;
  outcome: string;
  status: "done" | "blocked" | "failed" | "cancelled" | "superseded";

  decisions: FactRef[];
  facts: FactRef[];
  artifacts: ArtifactRef[];
  unresolved: FactRef[];

  source: {
    agentIds: string[];
    messageRanges: Array<{ agentId: string; fromIdx: number; toIdx: number }>;
  };
  revision: number;
  createdAt: number;
};
```

The nesting contract is:

1. A capsule summarizes only the outcome appropriate to its own level.
2. Detailed claims point to child capsules or raw refs.
3. Parent generation consumes verified child capsules and authoritative state, not arbitrary excerpts of old prose summaries.
4. Updating a child does not silently mutate a parent; it invalidates or revisions the parent capsule.
5. A branch can always be unfolded one level at a time.

### 5.6 Folding eligibility

A branch is eligible to fold when:

- its node is no longer an active leaf;
- it has a bounded outcome or an explicit blocked/failed result;
- unresolved side effects are represented in the capsule and pinned if still operationally relevant;
- all required tool call/result pairs are complete;
- artifacts and acceptance evidence have been captured;
- child branches are already folded or intentionally retained expanded;
- provenance validation succeeds.

Uncertain work should remain `paused` and either expanded or folded with clearly pinned open loops. “Old” alone is not completion evidence.

## 6. Tree growth and folding lifecycle

### 6.1 Growth

Each new event is attached to the most plausible active leaf:

```text
user instruction    → create/continue/switch track or goal
plan update         → create/update task nodes
tool call + result  → grow current episode
assistant outcome   → close episode or task candidate
delegation          → grow child-agent subtask subtree
team completion     → attach child result and close subtask branch
```

Attachment decisions are versioned proposals. Raw messages remain ordered independently, so an incorrect tree assignment can be repaired without transcript mutation.

### 6.2 Bottom-up folding

Folding proceeds from leaves toward the root:

```text
raw tool sequence
  → episode capsule
several episode capsules
  → task capsule
completed task capsules
  → goal capsule
closed goal / related tasks
  → track capsule
```

A parent can fold only when the children needed to explain its result have stable capsules. This is the matryoshka construction rule.

### 6.3 Progressive unfolding

The planner begins with the shallowest useful view. It expands only when the next request needs more precision:

```text
track capsule
  → task capsules
    → episode/subtask capsules
      → raw messages and tool results
```

Examples:

- “What did we decide about stale leases?” needs the track capsule.
- “Why did we choose a run token?” may unfold the design task capsule.
- “Show the exact SQL race” retrieves the source episode and raw code/tool result.

### 6.4 Reopening a folded branch

When the user returns to a closed track, the branch is not flattened back into the active transcript. Instead:

1. select the existing track node;
2. inject its capsule and relevant task children;
3. create a new active task/episode child;
4. retrieve old raw evidence only as needed;
5. revision the track capsule after the new work closes.

This preserves continuity without paying for the entire historical branch.

### 6.5 Multiple active leaves

The tree may have several active leaves when work is delegated or the user intentionally interleaves tracks. Context assembly should distinguish:

- **foreground leaf** — receives the largest verbatim and evidence budget;
- **background active leaves** — represented by structured state and recent capsules;
- **delegated leaves** — remain isolated in child transcripts until they emit results.


## 7. Continuous micro-compaction loop

### 7.1 Trigger

Analysis may start when any of these occur:

- 10–20k uncompacted tokens accumulated;
- 8–12 new messages accumulated;
- an explicit plan task completes;
- an independent tool-heavy subtask reaches a result;
- the agent emits final prose after a coherent tool sequence;
- the user switches tracks;
- context usage crosses a model-specific threshold;
- the agent becomes idle.

Thresholds schedule analysis; they do not define the final semantic boundary.

### 7.2 Analyzer input

A micro-compaction fork receives:

```text
current goal/track/task registry
previous active checkpoint
raw messages in [analyzedFrontier, sourceFrontier]
small overlap before analyzedFrontier
explicit plan/team state
```

The overlap lets the analyzer understand transitions without recursively feeding all previous summaries.

### 7.3 Analyzer output

The analyzer proposes:

- episode boundaries;
- track assignment;
- task assignment;
- new facts, decisions and artifacts;
- closed/open loops;
- possible track switch;
- possible independent-subtask boundary;
- source references for every retained claim.

The output is validated as structured data before activation.

### 7.4 Activation

Unlike current whole-context compaction, a completed micro-summary remains valid for its immutable message range even if newer messages arrive while analysis runs.

Activation requires:

- the analyzed messages still exist unchanged;
- no conflicting summary already owns the same range/version;
- referenced message indices belong to the declared range or overlap;
- task/track transitions do not violate authoritative plan state.

New messages after `sourceFrontier` do not make the analysis stale. They simply remain for the next pass.

## 8. Track detection

Track detection should combine explicit and inferred signals.

### 8.1 Strong explicit signals

- user says “new topic”, “separately”, “switch to”;
- a new `session.plan` is created with a different goal;
- the user returns to an earlier named issue;
- a new delegated task is created for an unrelated outcome.

### 8.2 Strong continuation signals

- “test it”, “finish”, “commit”, “push”, “what failed?”;
- references to files, errors, commits or decisions in the active track;
- completion work required by the active task;
- clarification of the immediately previous answer.

### 8.3 Inferred switch signals

A new track may be proposed when all are true:

1. the instruction expresses a new desired outcome;
2. semantic similarity to the active goal is low;
3. it does not depend on an active open loop;
4. its expected artifacts differ from the active track;
5. treating it as continuation would make the active goal incoherent.

Track inference must be reversible. A mistaken split can be merged; a mistaken merge can be split later without changing raw messages.

## 9. Large independent subtasks

### 9.1 Prospective isolation

When independence is known before execution, delegate immediately. The child receives a bounded packet and returns `summary + result`. The parent should not import the child transcript into its active context.

This is the cleanest compaction: noisy work never enters the parent context.

### 9.2 Retrospective isolation

Sometimes independence becomes clear only after inline execution. The micro-compactor can mark a contiguous range as an independent subtask and generate a task capsule.

The parent projection then replaces that range with the capsule while retaining raw provenance.

```text
before:
  request → 60 tool cycles → conclusion → tests

after:
  [subtask capsule: objective, result, decisions, artifacts, tests, refs]
```

### 9.3 Follow-up semantics

A follow-up may require detail omitted from the capsule. The context planner should retrieve:

1. the capsule;
2. matching raw messages from its range;
3. child transcript excerpts when `childAgentId` exists.

The capsule therefore acts like a durable subagent handle, not a terminal lossy summary.

## 10. Context assembly

`buildLlmRequest` evolves into a context planner with a token budget.

Suggested ordering:

```text
1. provider-required system prefix
2. pinned runtime/user constraints
3. active goal, track and task state
4. active structured checkpoint and open loops
5. relevant closed task/track capsules
6. retrieved raw evidence
7. recent verbatim messages
8. synthetic continuation user turn if required
```

Suggested initial budget policy:

| Layer | Budget |
|---|---:|
| Pinned instructions and constraints | required, not evictable |
| Active structured state | 10–15% |
| Relevant capsules | 10–20% |
| Retrieved raw evidence | 15–25% |
| Recent verbatim tail | 35–50% |
| Output/overflow reserve | model-specific |

Budget policy must be model-aware and based on actual usage/token estimates, not only character count.

## 11. Storage direction

The current `sleep_context` generation model is suitable for a single active whole-context projection but too coarse for a tree with many nested branches. A normalized design is likely preferable:

```text
context_nodes       -- session/track/goal/task/subtask/episode tree
context_capsules    -- versioned folded projections for nodes
context_sources     -- message ranges and child-agent transcript ranges
context_relations   -- supersedes, evidence-for, artifact-of, cross-track links
context_frontiers   -- analyzed and folded frontiers per root agent
```

`context_nodes.parent_id` supplies the normal tree. `context_relations` is reserved for non-owning cross-links; it must not make basic traversal depend on a general graph query.

All records should include:

- root `agent_id`;
- stable ID and revision;
- source message range;
- status;
- structured payload;
- summary text;
- model and prompt version;
- timestamps;
- provenance references.

An alternative v1 may store the same shape in one JSONB document on the root agent, but message-range lookup, concurrent writers and retrieval will eventually favor tables.

## 12. Relationship to existing mechanisms

### Manual `compactContext`

Keep as an emergency/manual whole-projection checkpoint. Continuous compaction should eventually make it uncommon.

### `agent.compact`

Retain as explicit destructive transcript maintenance, not as the primary memory mechanism.

### `session.plan`

Use as authoritative explicit task structure. The memory compiler may infer tasks only when no explicit task covers the episode.

### Team delegation

Treat completed child tasks as first-class subtask capsules. Do not duplicate child transcripts into parent context.

### Tool result stashing

Large results should remain durable and addressable while active context receives a compact result descriptor and retrieval handle.

## 13. Failure modes and safeguards

### Recursive summary drift

Do not produce a new truth solely by summarizing an old summary. Every claim requires raw refs, authoritative structured state, or explicit derivation provenance.

### Premature track closure

Close a track only on explicit completion, verified task completion, clear switch with no open loops, or a reversible timeout-based pause. Prefer `paused` over `closed` when uncertain.

### Lost constraints

Constraints are pinned separately. A summary cannot delete them.

### Broken causal chains

Episode boundaries must preserve assistant tool-call/result groups and the final interpretation that consumed those results.

### Duplicate or overlapping capsules

Use source-range ownership and revisions. Overlap is allowed only for declared hierarchical relations, such as episode inside task.

### Hallucinated artifacts

Commits, files, tests and DB identifiers should be verified against tools or raw messages before becoming structured artifacts.

### Analyzer lag

Analysis runs asynchronously. The active agent can continue; unanalyzed messages remain verbatim. Context pressure may trigger synchronous fallback to existing manual compaction.

## 14. Prior art and positioning

The broad idea is not new: several systems organize agent memory hierarchically, summarize completed subgoals, or retrieve through summary trees. The proposed design should be positioned as a durable synthesis and extension of those lines rather than as the invention of hierarchical memory itself.

### 14.1 MAGE: execution state as a tree

**Beyond Semantic Organization: Memory as Execution State Management for Long-Horizon Agents**
<https://arxiv.org/abs/2606.06090>

MAGE is the closest conceptual and algorithmic prior art. It argues that similarity-based RAG is a poor fit for long-horizon execution because it fragments decision trajectories, mixes valid and erroneous traces, and cannot reliably reconstruct state dependencies. Memory is instead treated as an active execution-state manager.

#### MAGE topology

MAGE maintains two linked tree layers:

```text
top layer:     completed-subgoal summary nodes
                 each summary.cover_nodes → ordered raw segment

bottom layer:  raw action-observation nodes in execution order
                 sibling branches → alternative or failed continuations
```

Bottom nodes contain an action-observation pair, `parent`, `children`, and an ID. Top nodes contain summary content, `parent`, `children`, ordered `cover_nodes`, and an optional diagnostic `note`. Runtime pointers `p_b` and `p_t` identify the active positions in the raw and compressed layers.

The context shown to the agent is:

```text
S = C + R + H

C — summaries on the root-to-p_t path
R — raw nodes since the last compression
H — sibling alternatives and diagnostic notes
```

This is extremely close to our proposed request projection: active root-to-leaf path, recent verbatim leaf detail, and compact information from relevant side branches.

#### MAGE state transitions

```text
Grow → Compress → Maintain → Revise
```

**Grow** runs after every action-observation. It appends a raw node or reuses an identical existing child, allowing execution to merge back into an explored path without duplicating it. Children of the new pointer become hints about already attempted continuations.

**Compress** runs when the agent marks a subgoal complete and supplies summary content, or as fallback when raw state crosses a size threshold. It traces raw nodes back to the last compressed boundary, creates/reuses a top summary node whose `cover_nodes` reference that exact segment, clears current raw state, and advances the top pointer. Compression is therefore boundary-aware rather than age-based.

**Maintain** immediately validates the new summary before trusting it. An LLM receives the task instruction, covered raw subtree and proposed summary, and checks for missing information, unsatisfied requirements and broken dependencies. Failure is stored as a diagnostic note and yields a revision target.

**Revise** restores raw and compressed pointers to a selected subgoal boundary. New actions then grow as a sibling branch, isolating the flawed segment while preserving unaffected progress. Hints include failed alternatives and diagnostic feedback so the agent does not repeat the same path.

#### What MAGE establishes

- execution state is a stronger organizing principle than semantic similarity alone;
- active context should follow the root-to-current path;
- completed subgoals are natural compression boundaries;
- summaries need validation before becoming trusted memory;
- failed trajectories should remain structurally isolated rather than deleted;
- revision should restore a boundary and branch, not rewrite history;
- bounded context can coexist with durable alternatives.

The paper reports a 7.8–20.4 percentage-point average task-success improvement over baselines on MemoryArena and a 55.1% token reduction. These results require independent reproduction, but they make MAGE the primary experimental baseline.

#### Mapping to this design

| MAGE | Context-tree design |
|---|---|
| raw action-observation node | episode observation/raw message range |
| completed-subgoal summary node | episode/task/subtask capsule |
| `cover_nodes` | capsule source ranges and child capsule refs |
| root-to-current path | root-to-active-leaf projection |
| sibling hints | retrieved side-branch capsules/artifacts |
| Grow | grow |
| Compress | fold |
| Maintain | validate capsule and evidence |
| Revise | reopen/unfold and grow a replacement branch |

#### Where this design extends MAGE

1. **Richer semantic topology.** MAGE is deliberately two-layer: raw traces and subgoal summaries. We model `session → track → goal → task → subtask → episode`, allowing recursive matryoshka folding at several work scales.
2. **Linear event sourcing.** The immutable Postgres transcript remains the canonical log; the tree is a repairable projection. MAGE primarily presents the tree itself as execution memory.
3. **Nested capsules.** Parent capsules reference child capsules and raw ranges, rather than only one top summary layer.
4. **Subagent lineage.** Delegated child transcripts are physical subtrees that return structured task capsules.
5. **Progressive unfolding.** Retrieval may expand track → task → episode → raw evidence one level at a time.
6. **Tracks and interleaving.** A durable chat can hold several weakly related goals and multiple active leaves, not only one task decomposition.
7. **Asynchronous conflict safety.** Folding is revisioned and validated against immutable source ranges while the root agent continues working.
8. **Fold versus prune.** Stored fold state is independent from request-specific relevance pruning.
9. **Pinned invariants.** Safety rules, user constraints and unresolved side effects are injected from authoritative state rather than left to summary salience.

#### Design changes suggested by MAGE

MAGE exposes gaps in the current proposal that should become explicit requirements:

- add a **Maintain/validation phase** before a capsule can become trusted;
- retain failed sibling branches with diagnostic notes as first-class evidence;
- let a capsule point to the exact ordered children/ranges it covers;
- support **reopen at a stable boundary**, then grow a sibling replacement branch;
- expose prior alternatives as bounded hints when revisiting a decision;
- prefer agent/task-declared completion, with token threshold only as fallback;
- evaluate state reconstruction and error isolation, not only retrieval recall.

MAGE terminology should be cited rather than silently renamed where the mechanism is identical. Our narrower novelty claim is the durable multi-level extension: event-sourced tracks/tasks/subagents plus recursively nested, reversible capsules.

### 14.2 HiAgent: fold completed subgoals, keep the active one detailed

**HiAgent: Hierarchical Working Memory Management for Solving Long-Horizon Agent Tasks with Large Language Model**
<https://arxiv.org/abs/2408.09559>
Code: <https://github.com/HiAgent2024/HiAgent>

HiAgent decomposes a task into subgoals, retains detailed action-observation history for the current subgoal, and replaces completed subgoal traces with summaries. It directly supports our most important folding heuristic:

> Completion state is a better compaction boundary than message age.

Differences:

- HiAgent primarily manages one working-memory trajectory rather than a durable multi-track session;
- completed histories are replaced by summaries rather than retained as nested, unfoldable capsules;
- it does not model explicit track/goal/task/episode levels;
- it does not combine child-agent isolation with immutable raw provenance.

HiAgent is the natural baseline for subgoal-aware folding policy.

### 14.3 Hierarchical retrieval and recursive summaries

Several systems support the matryoshka/progressive-disclosure part without organizing memory around execution tasks.

#### H-MEM

**Hierarchical Memory for High-Efficiency Long-Term Reasoning in LLM Agents**
<https://arxiv.org/abs/2507.22925>

Uses levels such as Domain, Category, Memory Trace and Episode, with layer-by-layer summaries and index-guided retrieval. It is close to nested capsules and progressive unfolding, but its hierarchy represents semantic abstraction rather than work decomposition.

#### H-Mem

**H-Mem: A Novel Memory Mechanism for Evolving and Retrieving Agent Memory via a Hybrid Structure**
<https://arxiv.org/abs/2605.15701>

Combines temporal-semantic trees, bottom-up search and graph retrieval. It informs retrieval over folded branches, but not goal/task lifecycle semantics.

#### Recursive dialogue summarization

**Recursively Summarizing Enables Long-Term Dialogue Memory in Large Language Models**
<https://arxiv.org/abs/2308.15022>

Shows that summaries can recursively carry dialogue state beyond the context window. It is a baseline for compression quality and drift, but lacks branch identity, completion semantics and reversible raw provenance.

#### Hierarchical Aggregate Tree / RAPTOR-style retrieval

**Enhancing Long-Term Memory using Hierarchical Aggregate Tree for Retrieval Augmented Generation**
<https://arxiv.org/abs/2406.06124>

These approaches aggregate child chunks into parent summaries and retrieve at multiple resolutions. They validate bottom-up summary trees, but the nodes are text/semantic clusters rather than execution branches.

### 14.4 Other relevant systems

- **MemForest** — hierarchical temporal indexing and localized dirty-path refresh: <https://arxiv.org/abs/2605.23986>. The dirty-path idea is relevant when a changed child invalidates only ancestor capsules on its path.
- **HiMem** — episode memory linked to abstract note memory with reconsolidation: <https://arxiv.org/abs/2601.06377>. Relevant to separating raw episodes from durable conclusions.
- **ReAcTree** — goal/subgoal execution trees and control flow, but not recursive persistent folding; DOI `10.65109/ucgt7089`.
- **MemoryOS** — promotion across short-, mid- and long-term layers: <https://arxiv.org/abs/2506.06326>. Relevant to lifecycle tiers, less to task topology.

### 14.5 What appears distinctive here

No reviewed system was found that combines all of the following in one runtime:

1. a physically linear, immutable event log projected into a semantic execution tree;
2. explicit `track → goal → task → subtask → episode` topology;
3. bottom-up folding of completed branches into nested capsules;
4. active context based on root-to-active-leaf paths;
5. reversible progressive unfolding to child capsules and raw evidence;
6. delegated subagents represented as physically isolated subtrees;
7. provenance, revisions and conflict-safe asynchronous folding;
8. request-time pruning that never deletes durable memory.

The novelty claim should therefore be narrow: not “hierarchical agent memory”, but the integration of execution-tree folding, durable event sourcing, subagent lineage and reversible evidence-backed capsules.

### 14.6 Evaluation baselines implied by prior art

The design should be compared against:

- full transcript;
- recency-only truncation;
- current whole-session summary + tail;
- recursive summary memory;
- HiAgent-style completed-subgoal summaries;
- MAGE-style active-path execution state;
- semantic hierarchical retrieval without task structure;
- the full proposed tree with capsules and raw unfolding.

Primary metrics:

- task completion and recovery after long interruptions;
- exact recall of constraints, decisions and identifiers;
- token cost and latency;
- incorrect reopening or track assignment;
- summary drift across repeated folds;
- ability to produce raw evidence for capsule claims;
- safety-rule retention;
- parent-context isolation for delegated subtasks.


## 15. Initial implementation phases

### Phase 1 — observe only

- detect candidate episode and track boundaries;
- store proposals with raw refs;
- render them in a debug UI;
- do not change model context.

### Phase 2 — completed task capsules

- compact explicit completed `session.plan` tasks;
- reuse delegated-child `summary + result` as capsules;
- retrieve raw ranges on demand.

### Phase 3 — track-aware projection

- infer track switches;
- keep active track detailed;
- replace paused/closed tracks with capsules in `buildLlmRequest`.

### Phase 4 — continuous micro-compaction

- asynchronously summarize completed inline episodes;
- introduce model-aware budgets;
- compact large old tool episodes automatically.

### Phase 5 — retrieval and evaluation

- retrieve raw evidence from closed tracks and subtasks;
- benchmark constraint recall, task completion, token use and summary drift;
- compare against full history, current manual compaction, recency-only and summary-only baselines.

## 16. Open questions

1. Is a goal always owned by one track, or may one goal intentionally span parallel tracks?
2. Should inferred tracks be user-visible and editable?
3. What is the minimum result contract for an inline independent subtask?
4. Which tool outputs need durable blob storage rather than message text?
5. How should retrieval rank raw evidence versus summaries and structured facts?
6. When should a paused track remain partially resident because it has unresolved side effects?
7. Should the analyzer be the same model as the active agent or a cheaper specialized model?
8. How do we evaluate whether a proposed track boundary improves future decisions rather than merely looking coherent?

## 17. Core hypothesis

The highest-value compaction boundary is not “the oldest N tokens”. It is “a branch of work whose result is complete enough that its expanded descendants can be replaced by a referenced capsule”.

A chat is physically linear, but the work described by the chat is not. The memory compiler incrementally projects that ordered event log into a growing execution tree. Goals and tracks define why branches exist. Tasks define what must be completed. Episodes define what happened at leaves. Independent subtasks provide the strongest branch boundary because they already have the same contract as a subagent: bounded input, isolated execution, structured result and an optional follow-up handle.

Compaction is therefore **tree folding**: active branches stay expanded, completed branches fold bottom-up into nested capsules, irrelevant branches are pruned only from individual requests, and any branch can be unfolded back to evidence.
