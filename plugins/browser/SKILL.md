---
name: browser
description: "Basic browser automation over Chrome DevTools Protocol (CDP) on :9222. Use to inspect open tabs, navigate a named background tab, read page text, evaluate JavaScript, click DOM elements, and take screenshots in the user's real Chrome."
---

# browser

Drives the user's real Chrome through CDP. Chrome must expose a debugging endpoint at `CDP_BROWSER_URL` (default `http://127.0.0.1:9222`). The plugin attaches to existing tabs or creates named background tabs and keeps their websocket handles in runtime state.

The agent receives these as native tools:

- `browser.googleSearch({ query, count?, session?, language?, keepOpen? })` — search Google and return compact `{ title, url, snippet }` results; closes its tab by default.
- `browser.googleAI({ question, followUps?, session?, language?, timeoutMs?, keepOpen? })` — run Google AI Mode; one-shot calls close their tab, conversations with `followUps` stay open by default for further questions.
- `browser.googleAIFollowUp({ question, session?, timeoutMs? })` — ask a follow-up in the same named AI Mode session, preserving conversation context.
- `browser.readPage({ url, session?, maxChars?, settleMs? })` — open one page and extract its main readable text.
- `browser.research({ query, pages?, maxCharsPerPage?, session?, keepOpen? })` — search, read several result pages concurrently, and close all task tabs by default.
- `browser.tabClose({ session? | targetId? })` — close one Chrome tab.
- `browser.closeSessions({ sessions? | prefix? })` — close task tabs in bulk; always clean up background sessions after research.
- `browser_tabs({})` — list open page tabs.
- `browser_navigate({ url, session? })` — navigate a named background tab.
- `browser_text({ session?, selector? })` — read visible text.
- `browser_evaluate({ expression, session?, awaitPromise? })` — evaluate JavaScript in the page.
- `browser_click({ selector, session? })` — click an element.
- `browser_screenshot({ session?, path?, fullPage? })` — save a PNG screenshot.

Sessions default to `main`; Google search defaults to `google-search`, AI Mode to `google-ai`, and multi-page reading uses independent `research-page-N` sessions. Prefer `browser.googleSearch`, `browser.googleAI`, and `browser.research` over manually scraping Google. AI Mode can be wrong: for factual work compare it with pages returned by `research`. Always close task-created tabs afterwards with `browser.closeSessions({ prefix })` or `browser.tabClose`. This plugin does not launch Chrome yet; it connects to the same `:9222` endpoint used by uniskill.
