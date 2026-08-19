---
name: substack
description: "Standalone Substack producer — subscription catalogue, archive metadata, authenticated full post bodies, per-publication cursors and strict incremental sync through Hyper Browser. It does not publish to News yet."
---
# Substack

Uses a logged-in Hyper Browser session named `substack`. It owns schema `substack`.

```ts
await ctx.fns.substack.status({});
await ctx.fns.substack.discover({});
await ctx.fns.substack.sync({ key: "tidyfirst", max: 30 });
await ctx.fns.substack.posts({ key: "tidyfirst", limit: 20 });
```
