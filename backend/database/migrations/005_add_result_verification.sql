-- A provider can briefly publish a FINISHED score and amend it moments later.
-- Keep the first settlement time in last_synced_at and mark the durable second
-- read separately, so verification survives restarts and runs exactly once.

ALTER TABLE fixtures
  ADD COLUMN IF NOT EXISTS result_verified_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_fixtures_pending_result_verification
  ON fixtures(last_synced_at)
  WHERE status = 'finished'
    AND sync_source IS NOT NULL
    AND result_verified_at IS NULL;
