---
name: research
description: "Evidence research over 220M+ peer-reviewed papers through Consensus — ask synthesized research questions, search ranked papers, inspect citations and continue contextual follow-ups. Use for scientific, medical and academic evidence questions."
---

# Research

Research peer-reviewed literature through the user's logged-in Consensus web subscription. Authentication uses the attached Chrome session: log in once at `consensus.app`; credentials and cookies are never returned by plugin functions.

## Functions

- `research.ask({ query, thread_id?, limit?, filters?, mode?, incognito?, session? })` — synthesized answer, verdict, consensus meter, grounded citations and enriched papers.
- `research.search({ query, thread_id?, limit?, filters?, mode?, incognito?, session? })` — ranked papers without synthesis.
- `research.start({ query, thread_id?, limit?, filters?, mode?, incognito?, session? })` — low-level create/continue primitive.
- `research.papers({ papers })` — normalize a raw Consensus papers payload.
- `research.call({ path, method?, body?, session?, raw? })` — low-level same-origin Consensus API request in the logged-in browser.

Use `thread_id` from a previous `ask` or `search` to ask a contextual follow-up.

```ts
const first = await ctx.fns.research.ask({
  query: "Does creatine improve cognition?",
  limit: 10,
});

const followUp = await ctx.fns.research.ask({
  query: "Which populations benefit most?",
  thread_id: first.thread_id,
});
```

## Filters

`filters` supports Consensus fields such as `study_types`, `year_min`, `year_max`, `sample_size_min`, `sjr_min`, `sjr_max`, `exclude_preprints`, `open_access`, `human`, `controlled`, `domain`, `clinical_guideline`, and `medical_mode`. Array values are converted to comma-separated API values.

Each `ask` or `search` can consume a Consensus PRO search allowance. Prefer `search` when a synthesis is unnecessary and use a reasonable `limit`.
