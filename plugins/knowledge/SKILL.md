---
name: knowledge
description: "Typed knowledge graph for people, organizations, products and concepts — canonical JSON facts, provenance, relations, validation, person matching and full-text search in the isolated Postgres schema knowledge. Use to look up known entities, contacts, organizations, products, concepts, facts and their sources."
---

# Knowledge

A standalone typed knowledge graph in Postgres schema `knowledge`. It owns canonical entities, provenance observations, derived relations and a searchable projection. It has no dependency on LinkedIn or another source: importers and future plugins submit normalized facts through the public API.

## Workflow

Search first, then read the selected entity with provenance and graph edges:

```ts
const hits = await ctx.fns.knowledge.find({ query: "Health Samurai" });
await ctx.fns.knowledge.get({ id: hits[0].id });
```

Create or update an entity without replacing unspecified fields:

```ts
await ctx.fns.knowledge.upsert({
  id: "Organization/health-samurai",
  data: { title: "Health Samurai", description: "Healthcare software company" }
});
```

Attach a sourced observation separately from canonical data:

```ts
await ctx.fns.knowledge.observe({
  subject: "Organization/health-samurai",
  attribute: "website",
  value: "https://health-samurai.io",
  source: "website",
  url: "https://health-samurai.io"
});
```

Use `knowledge.importFiles` to import the legacy `~/knowledge-base/<Type>/<slug>.md` and provenance NDJSON repository. Use `knowledge.resolve` after reference attributes change, and `knowledge.rebuildSearch` after bulk updates. `knowledge.validate` checks class-required fields; `knowledge.matchPerson` resolves names and phone numbers.

Future source plugins such as LinkedIn should remain independent and call `knowledge.upsert` / `knowledge.observe` as optional producers.

## Entity sidecar (agent chats)

When `scratchpad.knowledgeTrackingEnabled` is on for an agent (Meta panel → *Observed entities* → *Track entities*, or `knowledge.setTracking`), every successfully completed agent turn launches `knowledge.updateSidecar`: a hidden fork whose reporter submits `knowledge.setObservedMentions({ mentions })`. The extraction prompt includes an explicit JSON window of persisted parent messages, with durable indices in the text itself. Inherited history is context only. Failed extraction does not advance the authoritative `appliedSourceMessageIdx` checkpoint; oversized windows fail visibly instead of silently skipping text. Runs have a bounded deadline and archive their child on completion or failure.

`setObservedMentions` resolves each mention with `knowledge.resolveMentions` (exact Unicode-normalized names/aliases and validated existing entity IDs) and then writes **directly with provenance**: `matched` → observations on the existing entity, `new` → a canonical `Type/slug` created in the writer transaction, `ambiguous` → previewed only, nothing written. Each attribute, relation and the mention itself becomes a `knowledge.provenance` row with `source: agent-chat`, a verified source agent/message URL (legacy `hyper://agent/<id>/message/<idx>` is rendered as `/agent/<id>/message/<idx>`), verbatim evidence and confidence. The entity's Provenance section and Observed entities list link to a read-only persisted-message page with a backlink to the source chat. Deleted messages return 404; no unsupported `hyper://` navigation is required. Observations can be audited by source (this is not an automatic rollback facility):

```sql
SELECT subject, attribute, value, url, evidence FROM knowledge.provenance WHERE source = 'agent-chat' ORDER BY id DESC;
```

The sidecar receives a compact `CHAT_ENTITIES` list with current canonical facts and IDs already observed in this chat. Ordinary facts fill missing values; explicit `attributeUpdates` can add multi-values or correct fields already supported by this chat's provenance. Corrections require an explicit user correction quote with the subject and new values; conflicting observations alone never replace canonical values. Only schema-declared attributes and reference predicates are accepted. Reference updates keep graph edges consistent.

The writer stores entities, provenance, real field changes (`knowledge.entity_changes`), search projection and the applied checkpoint atomically. The inspector reports the last successful turn's add/change/no-op/conflict/skipped counts. Entity pages show grouped **Mentioned in** backlinks, compact provenance, and the latest 30 **History** entries with before/after values and source evidence. There is no retroactive history reconstruction or undo facility.

The fork retains REPL capabilities for cache sharing; it is not a security sandbox. Verified quote containment proves the reported text exists in the source, not that the claim itself is true. Isolated regression suites are `sidecar-updates.mock.test.ts`, `src/knowledge/*mock.test.ts`, `sidecarLifecycle.test.ts`, and `tests/`; do not use live shared-schema fixture tests.
