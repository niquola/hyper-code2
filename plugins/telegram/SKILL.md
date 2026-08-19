---
name: telegram-live
description: "Personal Telegram client over MTProto — find chats by title or username, list recent dialogs, read message history without marking it read, search messages globally or within a chat, find contacts, list folders and group participants, and perform guarded writes."
---

# Telegram

Read-only access to the user's personal Telegram account through GramJS/MTProto. The API credentials and authorized StringSession stay in 1Password vault `hyper`; they are never returned by plugin functions.

## Functions

- `telegram.me({})` — account metadata.
- `telegram.dialogs({ max? })` — recent chats, groups and channels.
- `telegram.findChat({ query, limit? })` — server-side search for direct chats, groups and channels by title, person name or username; own dialogs rank before global public results.
- `telegram.messages({ chat, max? })` — message history, oldest to newest; does **not** mark messages read.
- `telegram.search({ query, max? })` — global server-side message search.
- `telegram.searchChat({ chat, query, max? })` — search within one chat.
- `telegram.contacts({ query?, limit? })` — saved contacts or public/contact lookup.
- `telegram.folders({})` — dialog folders.
- `telegram.folder({ id })` — chats explicitly included in a folder.
- `telegram.participants({ chat, limit? })` — members of a group/channel.

- `telegram.reauth({ timeoutMs?, force? })` — idempotent login check. By default it returns `alreadyAuthorized: true` without opening a popup when the saved session is valid. If the session is invalid, it asks for the Telegram code and optional 2FA password in a browser popup and writes the resulting StringSession directly to 1Password vault `hyper`. Use `force: true` only for explicit credential rotation. Cancel terminates the entire login attempt.

The live MTProto client and session are internal and are never returned by plugin functions.

This version has no mark-read or general local Telegram mirror operations.

## News-channel producer

Telegram owns a durable broadcast-channel catalogue in `telegram.news_channels`; each channel has an independent JSON cursor (`maxMessageId`, `newestDate`). `telegram.news_posts` stores message content hashes and News links so edits are detected and unchanged posts are skipped.

- `telegram.newsDiscover({ folder?, add? })` — discover broadcast channels in a Telegram folder; excludes `Haiku` and `Just links` by default.
- `telegram.newsChannelAdd({ chat, title, folderId?, enabled? })` — add or update a channel.
- `telegram.newsChannels({ enabled? })` — list channels, cursors and post counts.
- `telegram.newsSyncChannel({ chat, max? })` — incrementally sync one channel through `news.put`.
- `telegram.newsSync({ max? })` — explicitly sync all enabled channels.

The producer never writes `news.items` directly. It ships no cron declaration; scheduling, if desired, belongs to the host. `Just links` remains disabled because link-following and article summarization require a separate producer.

## Write functions

These change the real Telegram account. Call only after an explicit user request and pass `confirm: true`:

- `telegram.send({ chat, text, parseMode?, confirm: true })` — send a text message.
- `telegram.sendFile({ chat, path, caption?, confirm: true })` — send a local file.
- `telegram.createFolder({ title, chats, confirm: true })` — create a dialog folder.
- `telegram.leave({ chat, confirm: true })` — leave a group/channel; destructive.

Without `confirm: true`, every write function refuses to act.

```ts
await ctx.fns.telegram.dialogs({ max: 20 });
await ctx.fns.telegram.search({ query: "Circleback", max: 10 });
await ctx.fns.telegram.findChat({ query: "ИИшница", limit: 10 });
await ctx.fns.telegram.messages({ chat: "-1001951583351", max: 30 });
```
