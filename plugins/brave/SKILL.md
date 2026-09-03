---
name: brave
description: "Low-level Brave Search API integration. Use only when Brave-specific filters or the raw provider response are required; prefer websearch.search for ordinary public-web discovery."
---

# Brave Search

Calls Brave's official Web Search API directly and returns normalized organic results together with the raw Brave response.

Prefer `websearch.search` for normal web discovery because it honors the configured default engine and returns a provider-neutral shape. Use `brave.search` directly only for Brave-specific country, language, freshness, pagination, SafeSearch, extra-snippet controls, or access to the raw Brave response. It is retrieval-only and does not open or summarize pages.

Authentication uses the `BRAVE_SEARCH_API_KEY` setting/environment variable. The key is sent in Brave's `X-Subscription-Token` header and is never accepted as a function argument or returned.
