---
name: youtube
description: "YouTube Data API and yt-dlp client — search videos/channels/playlists, fetch metadata and statistics, and extract captions as plain-text transcripts. Use for YouTube URLs, video research, channel stats, playlists, subtitles and transcripts."
---

# YouTube

Live YouTube Data API v3 plus transcript extraction through the installed `yt-dlp` binary. The API key stays in 1Password (`hyper` vault); transcript extraction does not expose it.

## Functions

- `youtube.search({ query, max?, type?, order?, channelId?, duration? })`
- `youtube.video({ id })` — one ID/URL or an array.
- `youtube.channel({ id })` — channel ID, handle or URL.
- `youtube.playlist({ id, max? })`
- `youtube.transcript({ id, lang? })` — `{ source, text, words }`.
- `youtube.parse({ url })`
- `youtube.api({ endpoint, params? })` — low-level read-only Data API GET.

```ts
await ctx.fns.youtube.search({ query: "Bun runtime", max: 3 });
await ctx.fns.youtube.transcript({ id: "dQw4w9WgXcQ", lang: "en" });
```
