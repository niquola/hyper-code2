---
name: gh
description: "GitHub REST API client — repositories, issues, pull requests, changed files, reviews, comments and GitHub search. Use for GitHub repos, code/issues/PR search, issue discussions and PR review context. Writes are guarded by explicit confirmation."
---

# GitHub

Live GitHub REST API through the locally authenticated `gh` CLI keyring, with `GH_TOKEN`/`GITHUB_TOKEN` as environment overrides. The token is never exposed by a plugin function.

## Read functions

- `gh.me({})`
- `gh.repo({ owner, repo })`
- `gh.search({ q, kind?, sort?, order?, max? })` — `kind`: `issues | code | repositories | commits | users`.
- `gh.issues({ owner, repo, state?, labels?, max? })`
- `gh.issue({ owner, repo, n, comments? })`
- `gh.prs({ owner, repo, state?, max? })`
- `gh.pr({ owner, repo, n, files?, reviews? })`
- `gh.api({ route, path?, params?, headers?, per_page?, page? })` — low-level REST escape hatch; GET/HEAD are read operations.

## Write functions

Only after an explicit user request; all require `confirm: true`:

- `gh.createIssue({ owner, repo, title, body?, labels?, assignees?, confirm: true })`
- `gh.comment({ owner, repo, n, body, confirm: true })`
- `gh.api({ route, ..., confirm: true })` for any non-GET request.

```ts
await ctx.fns.gh.repo({ owner: "HealthSamurai", repo: "aidbox" });
await ctx.fns.gh.search({ q: "repo:HL7/fhir is:issue SQL on FHIR", max: 5 });
await ctx.fns.gh.pr({ owner: "HealthSamurai", repo: "aidbox", n: 1, files: true, reviews: true });
```
