---
name: websearch
description: "Provider-neutral public web search and focused page processing. Use to retrieve ranked links through Brave or Google Browser, then open a selected public page and apply an LLM instruction to its readable content."
---

# Web Search and Fetch

Use `websearch.search` for ranked public-web links and snippets. It returns one stable result shape across two engines:

- `brave` — direct Brave Search API; fast and suitable for routine retrieval.
- `google-browser` — Google Search through the user's real Chrome; the default engine and useful for independent comparison.

The engine can be selected per call. When omitted, `websearch.defaultEngine` is used. Search is retrieval-only and does not generate an LLM answer.

Use `websearch.fetch` on a selected result URL with a focused prompt. It opens the URL through Browser, captures readable Markdown, and asks an LLM to apply the prompt. The model can be overridden per call; otherwise `websearch.fetchModel` is used, falling back to Hyper's global default model. Authenticated/private pages are not guaranteed; use a specialized plugin for those.
