---
name: research
description: "Evidence research over 220M+ peer-reviewed papers through Consensus — ask synthesized research questions, search ranked papers, inspect citations and continue contextual follow-ups. Use for scientific, medical and academic evidence questions."
---

# Research

Search uses the official Consensus REST API (`GET /v1/search`) with `research.apiKey`; create a key at `consensus.app/api-mcp`. Synthesized answers and contextual follow-ups still use the logged-in Consensus browser session because the public API currently exposes paper search, not synthesis. Credentials and cookies are never returned by plugin functions.

## Workflow

Use a synthesized answer when the user needs a conclusion with grounded citations; use ranked paper search when synthesis is unnecessary. Pass the returned `thread_id` into the next question to preserve context.

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

Each synthesized `ask` can consume a Consensus PRO web-search allowance. Official `search` consumes API allowance visible in the Consensus API dashboard. Prefer `search` when synthesis is unnecessary and use a reasonable `limit`. `include_full_text_chunks` is currently Enterprise-only.
