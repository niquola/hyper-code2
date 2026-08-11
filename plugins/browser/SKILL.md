---
name: browser
description: "Basic browser automation over Chrome DevTools Protocol (CDP) on :9222. Use to inspect open tabs, navigate a named background tab, read page text, evaluate JavaScript, click DOM elements, and take screenshots in the user's real Chrome."
---

# browser

Drives the user's real Chrome through CDP. Chrome must expose a debugging endpoint at `CDP_BROWSER_URL` (default `http://127.0.0.1:9222`). The plugin attaches to existing tabs or creates named background tabs and keeps their websocket handles in runtime state.

The agent receives these as native tools:

- `browser_tabs({})` — list open page tabs.
- `browser_navigate({ url, session? })` — navigate a named background tab.
- `browser_text({ session?, selector? })` — read visible text.
- `browser_evaluate({ expression, session?, awaitPromise? })` — evaluate JavaScript in the page.
- `browser_click({ selector, session? })` — click an element.
- `browser_screenshot({ session?, path?, fullPage? })` — save a PNG screenshot.

Sessions default to `main`. Use separate stable names for independent tasks. This plugin does not launch Chrome yet; it connects to the same `:9222` endpoint used by uniskill.
