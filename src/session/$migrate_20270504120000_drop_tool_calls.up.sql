-- Markers protocol is the only protocol now. Wipe legacy tool-calls data
-- (sessions where role='tool' messages or assistant.tool_calls existed) and
-- drop the columns. Runtime no longer reads or writes them.
--
-- We truncate all session data wholesale rather than try to salvage half of
-- old transcripts: the old agents had a different wire format and their
-- transcripts only make sense under tool-calls semantics.

DELETE FROM events;
DELETE FROM messages;
DELETE FROM agents;

ALTER TABLE messages DROP COLUMN tool_calls;
ALTER TABLE messages DROP COLUMN tool_call_id;
ALTER TABLE agents DROP COLUMN tools;
