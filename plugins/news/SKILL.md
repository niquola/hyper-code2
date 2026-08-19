---
name: news
description: "Durable news archive and reader — source-neutral item storage, search, filtering, read state and likes in isolated Postgres schema news. Use to browse or query already stored news. This core plugin intentionally does not fetch RSS, run jobs, summarize articles, or depend on source integrations."
---

# News

A standalone archive and reading surface for news already collected by external producers. It owns Postgres schema `news`, canonical item storage, read/like state, search, browsing and item details.

## Read workflow

```ts
await ctx.fns.news.list({ unread: true, limit: 20 });
await ctx.fns.news.get({ id: "..." });
await ctx.fns.news.search({ query: "Postgres", limit: 20 });
```

## Source-neutral writes

A separate producer may submit an already prepared item through `news.put`. The core preserves existing read, like and repost state unless those fields are explicitly provided.

```ts
await ctx.fns.news.put({
  id: "source/item-id",
  title: "Article title",
  source: "source-name",
  url: "https://example.com/article",
  summary: "Prepared summary"
});
```

This plugin contains no `$cron_*` declarations and no RSS, Hacker News, Telegram, LinkedIn, summarization or article-fetching functions. Those belong in independent producer plugins.
