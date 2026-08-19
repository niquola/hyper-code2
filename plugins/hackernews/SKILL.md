---
name: hackernews
description: "Standalone Hacker News mirror — configured Algolia feeds, normalized stories, feed membership, per-feed cursors and incremental sync runs. Use to sync or browse HN independently. It does not publish to News."
---
# Hacker News

```ts
await ctx.fns.hackernews.listFeeds({});
await ctx.fns.hackernews.sync({ feed: "front", limit: 100 });
await ctx.fns.hackernews.stories({ feed: "front", limit: 30 });
```

The plugin owns schema `hackernews` and has no dependency on the News plugin.
