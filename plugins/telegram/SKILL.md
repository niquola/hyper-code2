---
name: telegram-live
description: "Read-only personal Telegram client over MTProto — list recent dialogs, read message history without marking it read, globally search messages, search within a chat, find contacts, list folders and group participants. Use when the user asks to inspect or search their Telegram."
---

# Telegram

Read-only access to the user's personal Telegram account through GramJS/MTProto. The API credentials and authorized StringSession stay in 1Password vault `hyper`; they are never returned by plugin functions.

## Functions

- `telegram.me({})` — account metadata.
- `telegram.dialogs({ max? })` — recent chats, groups and channels.
- `telegram.messages({ chat, max? })` — message history, oldest to newest; does **not** mark messages read.
- `telegram.search({ query, max? })` — global server-side message search.
- `telegram.searchChat({ chat, query, max? })` — search within one chat.
- `telegram.contacts({ query?, limit? })` — saved contacts or public/contact lookup.
- `telegram.folders({})` — dialog folders.
- `telegram.folder({ id })` — chats explicitly included in a folder.
- `telegram.participants({ chat, limit? })` — members of a group/channel.

- `telegram.reauth({ timeoutMs?, force? })` — idempotent login check. By default it returns `alreadyAuthorized: true` without opening a popup when the saved session is valid. If the session is invalid, it asks for the Telegram code and optional 2FA password in a browser popup and writes the resulting StringSession directly to 1Password vault `hyper`. Use `force: true` only for explicit credential rotation. Cancel terminates the entire login attempt.

The live MTProto client and session are internal and are never returned by plugin functions.

This version has no mark-read, sync, or local Postgres mirror operations.

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
await ctx.fns.telegram.messages({ chat: "@channel", max: 30 });
```
