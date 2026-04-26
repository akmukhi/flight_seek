BEGIN;

ALTER TABLE issue
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_key text;

-- One canonical issue per provider+key.
CREATE UNIQUE INDEX IF NOT EXISTS issue_source_key_uidx
  ON issue(source, source_key)
  WHERE source IS NOT NULL AND source_key IS NOT NULL;

-- Avoid inserting the same event repeatedly.
CREATE UNIQUE INDEX IF NOT EXISTS issue_event_dedupe_uidx
  ON issue_event(source, source_ref, kind)
  WHERE source_ref IS NOT NULL;

COMMIT;

