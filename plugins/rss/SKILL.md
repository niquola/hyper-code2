---
name: rss
description: "Durable RSS/Atom feed library — subscriptions, incremental deduplicated loading three times daily, feed state and publication into News with shared one-paragraph summarization."
---

# RSS library

A standalone producer plugin in Postgres schema `rss`. It owns feed subscriptions, parsed entry state and load-run status. It never writes the `news` schema directly: prepared entries are published through `ctx.fns.news.put`.

```ts
await ctx.fns.rss.list({ enabled: true });
await ctx.fns.rss.add({ key: "example", url: "https://example.com/feed.xml", label: "Example", category: "tech" });
await ctx.fns.rss.load({ key: "example", limit: 30 });
await ctx.fns.rss.loadAll({ limit: 20 });
```

Every enabled feed is loaded every eight hours by the declared `rss-sync` cron. Entries are deduplicated by `(feed_key, external_id)` and a content hash: unchanged entries are neither republished nor summarized. New or changed entries are written through `news.put`, then summarized by `news.summarize`; summarization failures do not roll back ingestion. The plugin stores feed-provided title, URL, author, publication date, description and content, but does not fetch article pages.
