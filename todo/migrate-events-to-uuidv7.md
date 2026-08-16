# Migrate events to UUIDv7

## Why

Events are currently identified by the composite primary key `(agent_id, idx)`. This is efficient for ordered transcript reads and sufficient for internal HTMX URLs such as `/agent/:agentId/events/:eventIdx`, but `idx` is only unique within an agent and may be reassigned by `replaceEvents`.

A stable globally unique ID would allow:

- short resource routes such as `/events/:id`;
- permanent links to individual events and tool calls;
- moving or copying events without changing identity;
- simpler references from other tables and UI state.

## Proposed shape

Add a UUIDv7 identity while retaining `idx` for transcript ordering:

```sql
ALTER TABLE events ADD COLUMN id uuid;
UPDATE events SET id = ...; -- generate UUIDv7 for existing rows
ALTER TABLE events ALTER COLUMN id SET NOT NULL;
ALTER TABLE events ADD CONSTRAINT events_id_key UNIQUE (id);
```

Keep an index or unique constraint on `(agent_id, idx)`. Do not use UUID order as transcript order: `idx` remains authoritative, especially for imported/replaced history.

For new events, generate IDs with `Bun.randomUUIDv7()` in `session.appendEvent`. Update `save` and `replaceEvents` to preserve an existing event ID and generate one only when absent.

## Migration plan

1. Add nullable `events.id`.
2. Backfill UUIDv7 values in batches.
3. Add `NOT NULL` and unique index.
4. Include `id` in `session.getEvents` and event payload references.
5. Preserve IDs in `replaceEvents` and transcript compaction/deletion flows.
6. Introduce `GET /events/:id` for lazy tool details.
7. Keep the composite route temporarily for compatibility.
8. Update tests for uniqueness, persistence across replacement, and lookup authorization.

## Caveats

- A UUID is identity, not authorization. Event routes must still verify that the requesting UI/session may access the owning agent.
- Backfilled UUIDv7 timestamps will reflect migration time unless IDs are generated from `events.ts`; prefer deriving their timestamp from `ts` if the implementation supports it.
- Existing event payloads may contain `messageIdx`; this remains separate from event identity.
- Decide whether `replaceEvents` semantically preserves IDs by matching supplied IDs or intentionally creates new events when no IDs are supplied.

## The argument that changes the priority: idempotency keys must be ours

Written after [docs/durable-runs.md](../docs/durable-runs.md), which introduces effects,
spill locators, receipts and durable approvals — all of which need to point at *the tool
call that caused this*. Neither identifier we have today can carry that reference.

- **The provider's `tool_call_id` is not ours.** OpenAI emits `call_…`, codex emits `fc_…`,
  the next provider will emit something else. The moment we send an idempotency key
  outward (a Telegram send, a PR creation — the Stripe-style pattern the durable-execution
  research recommends) or store it as a foreign key, we bind correctness to a third
  party's artifact whose format, uniqueness and lifetime we do not control.
- **`(agent_id, idx)` is not stable.** `replaceEvents` reassigns `idx`, so any external
  reference eventually points at a different row — silently.

A UUIDv7 minted by us on the tool call solves both: it is stable across providers, stable
across transcript rewrites, safe to send outside, and safe to use as a foreign key from
`effects`, spill artifacts and approval records.

## Suggested order: tool calls first

Do the narrow slice before the broad one — the tool call is where every new mechanism
attaches, and it is a much smaller surface than the whole event stream:

1. `id uuid` on the tool-call row, generated with `Bun.randomUUIDv7()` (already used in
   `secureInput/prompt.ts`), backfilled for existing rows.
2. `effects`, spill locators, receipts and approvals reference **that** id.
3. Outward calls that support an idempotency key send that id, not the provider's.
4. Only then extend identity to events and messages, when permanent links are actually
   needed (`/events/:id`).

One correction to the backfill above: derive each backfilled UUIDv7's timestamp from the
row's `ts`, not from migration time. Otherwise every historical row claims to have been
created during the migration, and the "roughly time-ordered" property — the only reason to
pick v7 over v4 — is destroyed exactly where it would have been useful.

## The identity model this fits into

Written up in full in [docs/schema.md](../docs/schema.md). The short version: a history row
has **four independent properties**, and every attempt to make one column serve two of them
produces its own class of bug.

| Axis | Column | Question it answers |
|---|---|---|
| Identity | `id` | which row is this |
| Position | `idx` | where does it sit in the transcript |
| Version | `generation` | in which version of history is it visible |
| Time | `ts` | when did it actually happen |

Consequences for this note:

- **`messages` already has identity** — `id bigint GENERATED ALWAYS AS IDENTITY`, added for
  the BM25 index. It is half the size of a UUID and strictly increasing, so inserts land at
  the end of the index instead of scattering through it. For references *inside* the system
  it is the better key, and `events` should get the same rather than a UUID.
- **UUID belongs at the boundary only**: keys that leave for a third-party API, permanent
  public links, keys that must be known *before* the row is inserted, keys two processes
  mint without coordination. That is a separate `public_id uuid` column, not a replacement
  for the primary key.
- **Prefer v4 for outward keys.** v7 carries its creation time, which is exactly what makes
  it good internally (sortable, index-local) and needless to hand to a third party.
- **Version is not identity.** Destructive history edits (delete-from-here, compaction) are
  what break external references today; `generation` turns them into a filter, so nothing a
  reference points at ever disappears. That, not the URL shape, is the real reason to give
  tool calls a stable id.

## Current decision

Do not block chat paging or lazy tool rendering on this migration. Use `(agent_id, idx)` for now and revisit UUIDv7 when permanent event links or cross-agent event references are needed.

**Updated (decided).** One identity per row, `uuid` v7, everywhere — messages, events,
effects, process runs. No second id, no bigint/uuid split: a two-identifier rule is
something you have to remember at every call site, and it bought eight bytes.

The constraint that used to force bigint is gone: paradedb's BM25 index accepts a `uuid`
`key_field` — verified on our own database (pg_search 0.21.8) by building the index over a
uuid-keyed table and querying it. So `messages.id bigint GENERATED ALWAYS AS IDENTITY`
becomes `id uuid`, and the BM25 index is rebuilt with `key_field=id`.

`agents.id` stays short text (`ef`, `abx`): it is an address a human reads, types and sees
in a URL, not a machine identity. Full reasoning and the target schema live in
[docs/schema.md](../docs/schema.md).
