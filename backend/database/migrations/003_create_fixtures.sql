/* filepath: backend/database/migrations/003_create_fixtures.sql */
-- Drop table if exists
DROP TABLE IF EXISTS fixtures CASCADE;

-- Create fixture status enum
CREATE TYPE fixture_status AS ENUM ('upcoming', 'live', 'finished');

-- Create fixtures table
CREATE TABLE fixtures (
    id SERIAL PRIMARY KEY,
    home_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    away_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    match_date TIMESTAMP NOT NULL,
    deadline TIMESTAMP NOT NULL,
    gameweek INTEGER NOT NULL CHECK (gameweek >= 1 AND gameweek <= 38),
    status fixture_status DEFAULT 'upcoming',
    home_score INTEGER CHECK (home_score >= 0),
    away_score INTEGER CHECK (away_score >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT different_teams CHECK (home_team_id != away_team_id),
    CONSTRAINT scores_complete CHECK (
        (home_score IS NULL AND away_score IS NULL) OR 
        (home_score IS NOT NULL AND away_score IS NOT NULL)
    )
);

-- Create indexes
CREATE INDEX idx_fixtures_gameweek ON fixtures(gameweek);
CREATE INDEX idx_fixtures_match_date ON fixtures(match_date);
CREATE INDEX idx_fixtures_status ON fixtures(status);
CREATE INDEX idx_fixtures_home_team ON fixtures(home_team_id);
CREATE INDEX idx_fixtures_away_team ON fixtures(away_team_id);
CREATE INDEX idx_fixtures_deadline ON fixtures(deadline);

-- Create unique constraint to prevent duplicate fixtures
CREATE UNIQUE INDEX idx_fixtures_unique_match ON fixtures(home_team_id, away_team_id, gameweek);

COMMENT ON TABLE fixtures IS 'Premier League fixture schedule';
COMMENT ON COLUMN fixtures.deadline IS 'Prediction deadline for this fixture';
COMMENT ON CONSTRAINT different_teams ON fixtures IS 'Ensure home and away teams are different';