---
name: arxiv
description: "Public arXiv client — search preprints, fetch paper metadata and abstracts, generate Markdown notes and BibTeX, and download PDFs or source archives. Use for arXiv IDs, preprints, abstracts, citations and full paper artifacts."
---

# arXiv

Read-only access to the public arXiv Atom API plus PDF/source downloads. No login or API key is required. API calls are self-rate-limited to one request every three seconds.

## Workflow

Use search for discovery, then fetch metadata/abstract or download the artifact by ID. Field queries (`ti:`, `au:`, `abs:`, `cat:`, `id:`) pass through to arXiv.

```ts
await ctx.fns.arxiv.search({ query: "FHIR interoperability", max: 3 });
await ctx.fns.arxiv.get({ id: "1706.03762" });
await ctx.fns.arxiv.download({ id: "1706.03762", format: "pdf", dir: "papers" });
```

`research.papers` exposes `arxiv_id` for matching Consensus results, so use `arxiv.get` or `arxiv.download` to retrieve the abstract or paper artifact.
