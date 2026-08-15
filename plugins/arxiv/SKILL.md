---
name: arxiv
description: "Public arXiv client — search preprints, fetch paper metadata and abstracts, generate Markdown notes and BibTeX, and download PDFs or source archives. Use for arXiv IDs, preprints, abstracts, citations and full paper artifacts."
---

# arXiv

Read-only access to the public arXiv Atom API plus PDF/source downloads. No login or API key is required. API calls are self-rate-limited to one request every three seconds.

## Functions

- `arxiv.search({ query?, idList?, raw?, start?, max?, sortBy?, sortOrder? })` — search papers; plain text is wrapped in `all:` while field queries (`ti:`, `au:`, `abs:`, `cat:`, `id:`) pass through.
- `arxiv.get({ id })` — metadata and abstract for one arXiv ID; `arXiv:` prefix and version suffix are accepted.
- `arxiv.markdown({ id, out? })` — Markdown note containing metadata and abstract; optionally save it.
- `arxiv.bibtex({ id })` — generate an arXiv `@misc` BibTeX entry.
- `arxiv.download({ id, format?, dir?, path? })` — download `pdf`, `source`, or `both` into the current workspace or an explicit path.
- `arxiv.api({ params })` — low-level rate-limited Atom API request.

```ts
await ctx.fns.arxiv.search({ query: "FHIR interoperability", max: 3 });
await ctx.fns.arxiv.get({ id: "1706.03762" });
await ctx.fns.arxiv.download({ id: "1706.03762", format: "pdf", dir: "papers" });
```

`research.papers` exposes `arxiv_id` for matching Consensus results, so use `arxiv.get` or `arxiv.download` to retrieve the abstract or paper artifact.
