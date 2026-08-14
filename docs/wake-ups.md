# Durable agent wake-ups

Wake-ups survive process restarts because their state lives in Postgres and is polled by `agent.workerLoop`.

## Wake at a time

```ts
await ctx.fns.agent.wakeIn({
  id: agent.id,
  delayMs: 5 * 60_000,
  reason: "Check the build again",
})

await ctx.fns.agent.wakeAt({
  id: agent.id,
  at: Date.now() + 60 * 60_000,
  reason: "Continue in one hour",
})

await ctx.fns.agent.cancelWake({ id: agent.id })
```

Only one time-based alarm is stored per agent.

## Wake when a condition is met

```ts
await ctx.fns.agent.wakeUpWhen({
  id: agent.id,
  predicate: "file.exists",
  opts: { path: "build/result.json" },
  reason: "Build result appeared",
  everyMs: 30_000,
  timeoutMs: 10 * 60_000,
})
```

Built-in predicates are `file.exists`, `db.rows`, and `http.ok`. Watches are stored in `agent_watches`; multiple watches per agent are supported. The default polling interval is five minutes.

## Registered runtime function

`runtime.fn` can call any registered `ctx.fns` procedure by dotted name. It stores a function name and JSON args, never source code.

```ts
await ctx.fns.agent.wakeUpWhen({
  id: agent.id,
  predicate: "runtime.fn",
  opts: {
    name: "tmp.waitForEmail",
    args: { from: "person@example.com", after: Date.now() },
    callTimeoutMs: 15_000,
  },
  reason: "Email arrived",
  everyMs: 5 * 60_000,
  timeoutMs: 24 * 60 * 60_000,
})
```

The function must accept one opts object and return:

```ts
{ ready: false }
// or
{ ready: true, result: { /* compact JSON result */ } }
```

For project-local checks create `.hyper/<module>/<fn>.ts`, then run `procs.dev.genTypes` and `procs.repl.load`. Although `runtime.fn` permits any registered function, checks should normally be read-only, idempotent, quick, and return compact results. Errors are recorded and polling continues until timeout.
