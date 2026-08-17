# Embedded cron tasks

## Scope

Hyper runs a small durable cron queue for background runtime functions. Jobs are stored in Postgres and executed by an embedded worker in the HTTP Bun process.

The MVP intentionally supports only:

- recurring fixed-delay intervals (`every: "15m"`);
- one-shot jobs (`in: "30m"` or an absolute `at` time);
- runtime function targets such as `google.syncCalendar`;
- JSON-compatible arguments and results;
- a small execution history in `cron_jobs`.

It does **not** support cron expressions, time zones, retries, subprocess isolation, hard timeouts, or multiple scheduler owners.

## API

```ts
await ctx.fns.cron.add({
  name: "calendar-sync",
  fn: "google.syncCalendar",
  every: "15m",
  args: { account: "default" },
  now: true,
});

await ctx.fns.cron.defer({
  name: "calendar-once",
  fn: "google.syncCalendar",
  in: "30m",
  args: {},
});

await ctx.fns.cron.defer({
  name: "calendar-at",
  fn: "google.syncCalendar",
  at: "2029-02-01T09:00:00Z",
});

await ctx.fns.cron.list({ limit: 100 });
await ctx.fns.cron.runNow({ name: "calendar-sync" });
await ctx.fns.cron.remove({ name: "calendar-sync" });
```

Intervals accept a positive number of seconds or strings composed from `d`, `h`, `m`, and `s`, for example `1d`, `30m`, or `1h30m`.

## Execution model

`cron_jobs` contains both pending occurrences and completed history. The worker atomically changes a due row from `pending` to `running`, invokes the registered `ctx.fns.<namespace>.<function>`, and records `done` or `error`. A recurring job schedules its next occurrence after completion, so intervals are **fixed-delay** and do not overlap under normal operation.

On process startup, `running` rows left by an earlier process exit are marked as errors. Recurring interrupted rows get one new pending occurrence. The worker polls Postgres at most every 30 seconds and also uses an in-process wake signal for immediate local changes.

Execution is embedded and concurrent (up to four jobs by default). A hanging function cannot be forcibly killed and consumes one worker slot. This is the main reason to consider subprocess workers later.

## Web UI

Open `/cron` or choose **cron tasks** from global navigation. The page provides:

- a five-second live view of pending, running, completed, and failed occurrences;
- forms for recurring interval tasks and relative one-shot tasks;
- `Run now` and `Remove` actions for pending schedules;
- compact argument and first-line error inspection.

The MVP form accepts relative one-shot durations only. Use `cron.defer({ at })` through the runtime API for absolute timestamps. Arguments must be a JSON object.


## Operations and limitations

- Set `CRON_WORKER=off` to disable execution in a process.
- Only one process should have the embedded worker enabled.
- Postgres is the durable source of truth; the wake signal is only an optimization.
- `cron.remove` cancels pending occurrences but preserves completed history.
- `cron.runNow` moves an existing pending occurrence to the current time.
- Results are truncated to a marker when serialized JSON exceeds 8 KiB.
- Failed recurring jobs continue on their normal interval; automatic retries are not part of the MVP.

A future standalone worker can reuse `claim`, `runOne`, and the same table without changing task declarations.
