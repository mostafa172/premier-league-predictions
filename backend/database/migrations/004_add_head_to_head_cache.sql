-- Caches the last meetings between two clubs so the predictions page never
-- waits on the football API. A pairing's history only changes when the two
-- clubs meet again, so a row stays valid until one of their fixtures finishes.

CREATE TABLE IF NOT EXISTS head_to_head (
  id SERIAL PRIMARY KEY,
  -- Stored lowest id first so a matchup has exactly one row regardless of
  -- which club is at home in the fixture that triggered the lookup.
  team_a_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team_b_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  provider VARCHAR(32) NOT NULL,
  -- Array of { date, homeTeamId, awayTeamId, homeScore, awayScore }, newest
  -- first, using our own team ids so rendering never depends on the provider.
  matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT head_to_head_pair_ordered CHECK (team_a_id < team_b_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_head_to_head_pair
  ON head_to_head(team_a_id, team_b_id);
