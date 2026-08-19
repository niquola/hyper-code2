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
