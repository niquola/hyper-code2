# Owned agent memory: recall over past sessions

**Status:** conceptual design; not implemented. Motivated by
[funes](https://huggingface.co/blog/funes) (Hugging Face, 2026-09-03) and by the fact that
Hyper already stores everything such a memory would need.

## 1. Problem

An agent finishes a task and the reasoning behind it dies with the session.

The commit says `refactor: simplify CSV import`. The session says: the streaming parser was
tried, it broke on BOM and stray quotes in the legacy export, files never exceed 50 MB, so we
load into memory instead. Eight months later someone asks for a streaming parser again and the
agent cheerfully agrees, because the only thing it can see is the current transcript.

Hyper has the record. `messages` holds every turn of every agent, `searchBm25` can already grep
it lexically. What is missing is a memory an agent reaches for *by itself*, ranked, with exact
provenance, and spanning sessions other than the current one.

## 2. What funes does (the reference design)

Worth stating because the shape is good and the trade-offs are explicit.

- Source of truth is the raw session logs already on the machine (Claude Code, Codex, pi, Hermes).
- One deterministic pipeline parses every trace into the same **turn → block** shape, chunks it,
  embeds it with a pinned local model, and appends to a local **Lance** dataset.
- Indexing is **incremental per completed turn**; older history backfills in bounded steps.
- Query = vector + BM25, rank fusion, cross-encoder rerank, recency reweighting, neighbouring
  chunks attached.
- `recall` returns **the original text, not a summary**, plus agent / timestamp / session / turn,
  and a `get` command that opens the full turn with context.
- **Nothing is distilled into facts at write time.** A hit always leads back to the turn.
- Secrets are redacted at indexing and rescanned before publishing.
- The shared form of a memory is a **dataset you own** (private HF dataset), not a service you rent.
- Measured claim: on the handoff-vs-recall benchmark, compaction solved one task and failed the
  other (its summary flattened the finding that mattered); recall was cheapest on both — 8x
  cheaper than a written handoff on one task, 4x on the other.

## 3. Why this fits Hyper unusually well

We do not need the ingest half at all. It is already there.

| funes needs | Hyper already has |
| --- | --- |
| collect traces from agent CLIs | `messages` table, every agent, durable |
| a turn/block shape | `messages(agent_id, idx, role, content, tool_calls, tool_call_id, message_type, ts)` |
| local Lance dataset + own index | Postgres/ParadeDB: BM25 (`messages_bm25`) + `halfvec` HNSW |
| embeddings | `ctx.fns.embeddings.embed` |
| hybrid retrieval + RRF | exactly the pattern in `src/runtime/docs/search.ts` and `src/plugins/search.ts` |
| a tool the agent reaches for | the `$tool_` registry / function RAG injection |
| provenance UI | agent + `idx` already address a message; `/agent/:id` can deep-link it |

So the work is a **retrieval layer over `messages`**, not a storage project.

Relationship to existing designs:

- `docs/continuous-context-compaction.md` folds the *current* session into capsules. Memory recall
  is the complementary direction: retrieve verbatim evidence from *other, finished* sessions.
  Compaction is lossy by construction; recall is the escape hatch when compaction lost the detail.
- `docs/rag.md` (function RAG) is the same machinery pointed at function docs. Reuse its index /
  search / eligibility structure; do not invent a second one.

## 4. Proposed shape

### 4.1 Chunks

New table `message_chunks`, derived and rebuildable, never authoritative:

```
message_chunks(
  id bigserial pk,
  agent_id text,
  msg_idx int,          -- the message it came from
  seq int,              -- chunk order inside the message
  role text,
  content text,         -- verbatim slice, redacted
  ts bigint,
  content_hash text,    -- skip re-embedding unchanged chunks
  embedding public.halfvec(1536),
  embedding_provider text,
  embedding_model text
)
```

Plus a BM25 index on `content` and an HNSW index on `embedding`, mirroring
`$migration_20290801000000_functions_index.ts`.

Chunking rules (deliberately dumb and deterministic):

- one message → one or more chunks, split on ~1–2k chars at block boundaries;
- keep `role`, keep tool-call linkage via `msg_idx`;
- skip pure noise: stashed blobs, base64, giant tool dumps beyond a size cap — index their head
  and the fact that they existed, not the payload;
- redact secrets on the way in (env-looking values, `sk-`/`ghp_` shapes, `Authorization:` lines).

### 4.2 Indexing trigger

Incremental, per completed turn, exactly like funes:

- after a run completes, index messages with `idx > last_indexed_msg_idx` for that agent;
- store the watermark next to the queue state in `agents` (a `last_indexed_msg_idx` column) so it
  reuses the existing inline-queue discipline;
- a `memory.backfill({ limit })` procedure walks old agents in bounded steps.

Functions, one per file:

```
src/memory/chunk.ts        split one message into chunks
src/memory/index.ts        index new messages for an agent (incremental)
src/memory/backfill.ts     bounded backfill over old agents
src/memory/recall.ts       hybrid search → ranked hits with provenance
src/memory/get.ts          open a full turn plus N surrounding messages
src/memory/redact.ts       secret scrubbing, shared by index and export
src/memory/$tool_recall.md tool description for the agent
```

### 4.3 Recall

`memory.recall({ query, scope?, agentId?, before?, limit? })`:

1. BM25 over `message_chunks.content` (ParadeDB `@@@`, snippet highlighting);
2. vector search over `embedding` with the query embedding;
3. RRF fusion of the two rankings;
4. recency reweighting (a decayed multiplier, not a hard cutoff — old decisions still matter);
5. attach neighbouring chunks of each hit;
6. return **verbatim text** plus `{ agentId, agentTitle, msgIdx, role, ts }` and a
   `memory.get({ agentId, msgIdx })` handle.

Scope defaults matter more here than in function RAG:

- `scope: "self"` — this agent and its fork ancestry (cheap, always safe);
- `scope: "workspace"` — all agents whose `workspace_dir` matches (the useful default);
- `scope: "all"` — everything.

Because a Hyper user's transcripts include health records, invoices and private mail, `scope`
should default to `workspace`, and cross-workspace recall should be an explicit setting.

### 4.4 How the agent uses it

Two entry points, mirroring funes:

- **`recall` as a tool** — the agent decides mid-conversation, the way it now reaches for
  `grep`. This is the important one: no user ceremony, no pasting old context.
- **`memory.ask({ query })`** — read-only, one question, for the human. Answers from retrieved
  passages, names sources, and says plainly when the passages do not support an answer.

And one automatic hook: when function RAG already injects candidate functions for a user prompt,
the same turn can inject the top recall hit *if* its fused score clears a threshold. Same audit
event, same ƒ-style tooltip, same abstain-when-weak rule as `docs/rag.md`.

## 5. Design commitments

- **Derived, never authoritative.** `message_chunks` can be dropped and rebuilt from `messages`.
- **No distillation at write time.** No summaries in the index. Summarization is what loses the
  BOM detail; the whole point is that a finding must not have to survive a paraphrase.
- **Always provenance.** Every hit carries agent, session, turn index and timestamp, and opens.
- **Local by default.** Embeddings go through `ctx.fns.embeddings`; a local provider must remain
  a supported configuration, because indexing every transcript through a hosted API is a
  different privacy proposition than answering with one.
- **Abstain over invent.** A retrieval miss is reported as a miss.

## 6. Open questions

- **Embedding cost at our volume.** How many chunks does the existing corpus produce, and what
  does a full backfill cost once? Measure before building.
- **Value of a cross-encoder rerank.** funes uses one. We currently stop at RRF. Worth an
  evaluation harness like `docs/function-rag-evaluation.md` before adding a second model.
- **Deduplication.** Long agent loops repeat themselves; ten near-identical chunks in a result set
  are worse than three distinct ones. Needs a similarity cap per result set.
- **Privacy boundary.** Plugin-heavy transcripts (health, mail, CRM) inside a general recall index
  is the main risk of this design. Per-agent `memory_indexed` opt-out flag? Deny-list by workspace?
- **Portability.** funes' "memory is a dataset you own" maps to exporting `message_chunks` +
  source messages as a portable artifact. Interesting, not first.
- **Interaction with compaction.** When a session is compacted, its raw messages stay in
  `messages`, so they stay recallable. That is the strongest argument for building this: it makes
  aggressive compaction safe.

## 7. Suggested first slice

Smallest thing that proves the value, roughly a day:

1. `message_chunks` migration + `memory.index` + `memory.backfill` for the current workspace only;
2. `memory.recall` with BM25 + vector + RRF, no rerank, no recency decay;
3. expose it as a tool with `scope: "workspace"`;
4. try it on a real question whose answer only exists in an old session ("why did we drop X?") and
   compare against `session.searchBm25` on the same question.

If plain BM25 already answers such questions, stop there — that is a real possible outcome and
cheaper than the whole pipeline.
