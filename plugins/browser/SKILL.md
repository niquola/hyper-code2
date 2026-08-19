---
name: browser
description: "Browser automation over Chrome DevTools Protocol (CDP) on :9222. Use to inspect and navigate named tabs, capture compact accessibility or readable-content snapshots, interact with pages, run Google workflows, and take screenshots in the user's real Chrome."
---

# browser

Drives the user's real Chrome through CDP. Chrome must expose a debugging endpoint at `CDP_BROWSER_URL` (default `http://127.0.0.1:9222`). The plugin attaches to existing tabs or creates named background tabs and keeps connection handles in runtime state.

## Observe before acting

Use `browser.snapshot` as the observation primitive:

- `interactive` returns a compact accessibility view with revision-scoped refs such as `@r2e7`.
- `text` returns visible text; set `readable: true` to prefer article/main content.
- `markdown` and `html` return cleaned readable content.
- `a11y` returns the broader accessibility tree.
- `sinceRevision` requests an explicit change summary against an earlier snapshot from the same session.

Snapshot refs are scoped to one logical session and document revision. Capture a new interactive snapshot after navigation or when an action reports `STALE_REF`. Prefer refs when available; CSS and visible-text targets are strict fallbacks and fail on multiple visible matches instead of choosing the first.

## Choose the precise interaction

Use the focused browser functions for ordinary work:

- `browser.click` for one actionable target. The legacy CSS `selector` option remains supported.
- `browser.fill` to replace one or several plain form values without submitting. Batching the fields of one form reduces tool calls and stops at the first failure.
- `browser.type` for autocomplete, rich editors and applications that require actual CDP text input. Use `clear: true` to replace existing text; prefer this over `fill` when suggestions must appear.
- `browser.press` for keys and combinations. `Tab` and `Shift+Tab` include deterministic focus traversal fallback when Chrome does not move focus itself.
- `browser.select` for native select options by exact value or visible label.
- `browser.check` to set checkbox/radio state idempotently, including visually hidden native controls used by styled widgets.
- `browser.hover` and `browser.scroll` for pointer and viewport interactions.

`browser.act` exposes the same engine for an ordered advanced batch. Batches are fail-fast and return successful partial results plus a structured failed step. Keep batches short: refs or page state can become stale between unrelated actions, and explicit observe/verify calls are easier to diagnose.

Targets use one locator:

```ts
{ ref: "r2e7" }
{ css: "#destination" }
{ text: "Search", exact: true }
```

Actions auto-wait for attachment, visibility and actionability. Target ambiguity, stale refs, hidden/disabled controls and partial failures are surfaced explicitly. Filling and typing never submit a form by themselves.

## Sessions, cleanup and low-level access

Named sessions default to `main`. High-level Google workflows use task-specific sessions, and multi-page research uses independently named page sessions. Task-created tabs should normally be closed with the tab/session cleanup functions. High-level workflows clean up temporary sessions unless callers intentionally request `keepOpen`.

Prefer the high-level Google search, AI and research workflows for those tasks rather than scraping Google manually. AI-generated answers can be wrong; compare factual claims with source pages. Consent pages, login challenges and CAPTCHA are reported as errors rather than silently returning empty results.

All CDP capabilities remain public. Use `browser.evaluate`, `cdp.send` or `cdp.session` when the focused browser operations do not expose a required Chrome capability. This plugin connects to an existing debuggable Chrome; it does not launch the browser.
