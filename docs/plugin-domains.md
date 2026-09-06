# Website routing metadata

Plugins may declare trusted website registrations in their own `package.json`:

```json
{"procs":{"domains":["github.com","api.github.com","*.example.com"]}}
```

This optional `procs.domains: string[]` field propagates through module discovery, mounted module state, `plugins.list({})` and `plugins.read({name})`. Missing fields become `[]`. Only installed/mounted plugins participate. Call `plugins.reload({})` after manifest edits; reloading a function alone does not refresh mounted metadata.

`plugins.forUrl({url})` returns mounted matching plugin names, bounded capability descriptions and registered domains. `plugins.siteHint({url})` renders at most four matches as escaped JSON with a workflow-read instruction. Neither function searches with an LLM, reads page content, loads full workflow documentation nor executes plugin operations.

## Matching rules

- Exact hostname by default, case-insensitive. Paths/query/title do not participate.
- `*.example.com` explicitly permits dot-delimited subdomains, **not** `example.com`. Register both when needed. Plugin authors must use only their actual site suffix, never a public suffix such as `*.co.uk`.
- `youtube.com.evil` and `notyoutube.com` never match `youtube.com`.
- Only absolute HTTP(S) URLs, at most 4096 characters; credentials, invalid hosts, IPs and localhost are excluded. Port numbers are not domain registrations and cannot broaden matching. A valid public hostname matches on any port.
- No automatic service-to-plugin map, arbitrary `google.com` catch-all, path-based routing, keyword lists or unmounted namespace guesses.
- Discovery retains at most 100 string declarations of at most 253 characters. Invalid hostname rules are ignored at matching time.

The bound-sidebar prompt hook runs after the existing server-owned binding refresh on every LLM request, only for active bindings. Navigation therefore replaces/removes the hint. Null binding, missing sidebar lookup and unavailable/revoked bindings produce no routing hint. Nothing creates an agent on panel open or changes URL/chat reuse.

Hints are trusted installed-package metadata, kept separate from untrusted page URL/title. They prefer the plugin only for documented capabilities, require `plugins.read({name})` first, distinguish API/mirror access from reading the current UI, preserve the bound CDP guard and do not authorize other tabs. Workflows needing another tab must request permission through the existing supported flow.

## Initial registrations and provenance

- `youtube`: youtube.com, www.youtube.com, youtu.be — `src/youtube/{search,transcript,parse}.ts`.
- `google`: docs.google.com, drive.google.com — `src/gdoc/{create,upload,createFolder}.ts`. Mail/calendar web hosts are intentionally not guessed from API capability names.
- `zulip`: chat.fhir.org — SKILL.md configured instance example.
- `gh`: github.com and api.github.com — GitHub REST workflow in SKILL.md and `src/gh/api.ts`.

- `arxiv`: arxiv.org — `src/arxiv/download.ts` PDF/source URLs.
Optional packages still need to be mounted to produce hints. No USER_PLUGINS files were changed; private plugins can add the same field to their package manifests and reload. There is no central registry to update.

Tests: `bun test ./src/plugins/siteHint.test.ts` (host boundaries, invalid URLs, absent plugin, short escaped hint, fresh navigation, null binding, missing sidebar and metadata projection).
