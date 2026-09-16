-- Adds the columns the external football API sync needs to identify rows it
-- owns. Everything here is additive and nullable: existing fixtures keep a NULL
-- sync_source, which marks them as manually managed and therefore off limits to
-- the sync.

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS external_id INTEGER,
  ADD COLUMN IF NOT EXISTS external_source VARCHAR(32);

ALTER TABLE fixtures
  ADD COLUMN IF NOT EXISTS external_id INTEGER,
  ADD COLUMN IF NOT EXISTS sync_source VARCHAR(32),
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_external
  ON teams(external_source, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fixtures_external
  ON fixtures(sync_source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fixtures_sync_source ON fixtures(sync_source);

-- The baseline unique index on (home_team_id, away_team_id, gameweek) blocks a
-- rescheduled match from moving between gameweeks while its old row still
-- exists. Identity is now the provider match id, so relax the constraint to
-- allow a fixture to change gameweek.
DROP INDEX IF EXISTS idx_fixtures_unique_match;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fixtures_unique_manual_match
  ON fixtures(home_team_id, away_team_id, gameweek)
  WHERE external_id IS NULL;

CREATE TABLE IF NOT EXISTS sync_runs (
  id SERIAL PRIMARY KEY,
  job VARCHAR(32) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  competition VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'running',
  dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  fixtures_created INTEGER NOT NULL DEFAULT 0,
  fixtures_updated INTEGER NOT NULL DEFAULT 0,
  fixtures_skipped INTEGER NOT NULL DEFAULT 0,
  predictions_scored INTEGER NOT NULL DEFAULT 0,
  api_requests INTEGER NOT NULL DEFAULT 0,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  error TEXT,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_started_at ON sync_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_job ON sync_runs(job);
