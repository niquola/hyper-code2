---
name: research
description: "Evidence research over 220M+ peer-reviewed papers through Consensus — ask synthesized research questions, search ranked papers, inspect citations and continue contextual follow-ups. Use for scientific, medical and academic evidence questions."
---

# Research

Research peer-reviewed literature through the user's logged-in Consensus web subscription. Authentication uses the attached Chrome session: log in once at `consensus.app`; credentials and cookies are never returned by plugin functions.

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

Each `ask` or `search` can consume a Consensus PRO search allowance. Prefer `search` when a synthesis is unnecessary and use a reasonable `limit`.
