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

## Current decision

Do not block chat paging or lazy tool rendering on this migration. Use `(agent_id, idx)` for now and revisit UUIDv7 when permanent event links or cross-agent event references are needed.
