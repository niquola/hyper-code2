# News core plugin

The `news` core plugin is a durable archive and reader for already prepared news items. It owns the isolated Postgres schema `news` and intentionally does not fetch sources or schedule ingestion.

## Scope

Included:

- source-neutral item storage through `news.put`;
- archive listing and full-text search;
- source, unread and liked filters;
- read and liked state;
- story details with stored short/long summaries and article text;
- keyboard slideshow reader;
- Hyper navigation entry at `/news`.

Excluded:

- RSS and feed polling;
- cron or background jobs;
- Hacker News, Telegram, LinkedIn or other source clients;
- article fetching and summarization;
- reposting or publishing integrations.

Independent producer plugins may call `news.put` with an already prepared item.

## Runtime API

```ts
await ctx.fns.news.list({ unread: true, limit: 20 });
await ctx.fns.news.search({ query: "Postgres", source: "hn" });
await ctx.fns.news.get({ id: "source-item-id" });
await ctx.fns.news.setRead({ ids: ["source-item-id"], read: true });
await ctx.fns.news.setLiked({ id: "source-item-id", liked: true });

await ctx.fns.news.put({
  id: "producer/item-id",
  title: "Prepared headline",
  source: "producer",
  url: "https://example.com/story",
  summary: "Prepared summary",
  shownAt: new Date().toISOString()
});
```

`news.put` updates mutable stored content but preserves existing reader state such as `read_at`, `liked_at`, and repost metadata.

## Web UI

- `/news` — feed/archive with search and filters;
- `/news/:source/:id` — stored story detail;
- `/news/reader` — keyboard slideshow;
- `/news/reader/at` — HTMX reader fragment.

Use the **Reader** button in the archive header to open the slideshow with the current source/search/unread filters.

## Keyboard reader

The reader shows one stored story at a time and uses physical key codes, so shortcuts work with non-Latin keyboard layouts:

| Key | Action |
|---|---|
| `J` | next story |
| `K` | previous story; first uses client-side history |
| `Space` | show or hide stored expanded summary/article text |
| `L` | toggle liked state |
| `Enter` | open the original URL in a new tab, or local details when no URL exists |

The reader uses shared `procs.ui` components for breadcrumbs, tags, badges, cards, toolbars and buttons. Keyboard controls are ignored while an input, textarea or select is focused.

## Data migration

The initial migration copied the existing durable archive from the legacy uniskill `news.items` table into Hyper. The migration was verified with a full row-by-row comparison of all durable columns:

```text
source rows: 1560
target rows: 1560
mismatches: 0
unread: 96
liked: 103
sources: 36
```

Opening an item marks it read, so these state counts naturally change during normal UI use.

## Security and boundaries

The plugin has no package dependencies and no source-specific runtime calls. Its only external write surface is the explicit, source-neutral `news.put` API. Any future RSS, LinkedIn, Telegram or Hacker News integration should be a separate producer plugin rather than a dependency of core News.
