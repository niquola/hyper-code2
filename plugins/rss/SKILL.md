---
name: rss
description: "Durable RSS/Atom feed library — subscriptions, feed metadata, parsed entry state and explicit loading into the independent News core through news.put. Use to add/list/manage feeds, preview XML, load one feed, or inspect sync status."
---

# RSS library

A standalone producer plugin in Postgres schema `rss`. It owns feed subscriptions, parsed entry state and load-run status. It never writes the `news` schema directly: prepared entries are published through `ctx.fns.news.put`.

```ts
await ctx.fns.rss.list({ enabled: true });
await ctx.fns.rss.add({ key: "example", url: "https://example.com/feed.xml", label: "Example", category: "tech" });
await ctx.fns.rss.load({ key: "example", limit: 30 });
await ctx.fns.rss.loadAll({ limit: 20 });
```

Loading is explicit. This plugin ships no cron declaration and does not summarize or fetch article pages; it stores the feed-provided title, URL, author, publication date and description, then calls `news.put`.
