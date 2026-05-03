ALTER TABLE messages ADD COLUMN excluded_from_cursor INTEGER NOT NULL DEFAULT 0;

-- Backfill existing synthetic tool-feedback messages so workerLoop's frontier
-- query stops counting them as new user input. These are runMarkers-emitted
-- §result:* / §error:* user-rows that exist purely to feed results back
-- to the model — they should not retrigger another run. (Pre-migration data
-- used `///` prefix; both forms backfilled for safety on upgraded installs.)
UPDATE messages
   SET excluded_from_cursor = 1
 WHERE role = 'user'
   AND (content LIKE '///result:%' OR content LIKE '///error:%'
     OR content LIKE '§result:%'   OR content LIKE '§error:%');
