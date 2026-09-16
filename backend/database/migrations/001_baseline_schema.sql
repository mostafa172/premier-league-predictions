DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fixture_status') THEN
    CREATE TYPE fixture_status AS ENUM ('upcoming', 'live', 'finished');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  abbreviation VARCHAR(5) NOT NULL UNIQUE,
  logo_url VARCHAR(255),
  color_primary VARCHAR(7),
  color_secondary VARCHAR(7),
  founded_year INTEGER,
  stadium VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fixtures (
  id SERIAL PRIMARY KEY,
  home_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  match_date TIMESTAMP NOT NULL,
  deadline TIMESTAMP NOT NULL,
  gameweek INTEGER NOT NULL CHECK (gameweek BETWEEN 1 AND 38),
  status fixture_status NOT NULL DEFAULT 'upcoming',
  home_score INTEGER CHECK (home_score >= 0),
  away_score INTEGER CHECK (away_score >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT different_teams CHECK (home_team_id <> away_team_id),
  CONSTRAINT scores_complete CHECK (
    (home_score IS NULL AND away_score IS NULL)
    OR (home_score IS NOT NULL AND away_score IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fixture_id INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
  predicted_home_score INTEGER NOT NULL CHECK (predicted_home_score BETWEEN 0 AND 20),
  predicted_away_score INTEGER NOT NULL CHECK (predicted_away_score BETWEEN 0 AND 20),
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  is_double BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, fixture_id)
);

CREATE TABLE IF NOT EXISTS leagues (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  join_code VARCHAR(10) NOT NULL UNIQUE,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS league_memberships (
  id SERIAL PRIMARY KEY,
  league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (league_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);
CREATE INDEX IF NOT EXISTS idx_teams_abbreviation ON teams(abbreviation);
CREATE INDEX IF NOT EXISTS idx_fixtures_gameweek ON fixtures(gameweek);
CREATE INDEX IF NOT EXISTS idx_fixtures_match_date ON fixtures(match_date);
CREATE INDEX IF NOT EXISTS idx_fixtures_status ON fixtures(status);
CREATE INDEX IF NOT EXISTS idx_fixtures_home_team ON fixtures(home_team_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_away_team ON fixtures(away_team_id);
CREATE INDEX IF NOT EXISTS idx_fixtures_deadline ON fixtures(deadline);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fixtures_unique_match
  ON fixtures(home_team_id, away_team_id, gameweek);
CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_fixture_id ON predictions(fixture_id);
CREATE INDEX IF NOT EXISTS idx_predictions_points ON predictions(points);
CREATE INDEX IF NOT EXISTS idx_predictions_is_double ON predictions(is_double);
CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_leagues_join_code ON leagues(join_code);
CREATE INDEX IF NOT EXISTS idx_leagues_created_by ON leagues(created_by);
CREATE INDEX IF NOT EXISTS idx_league_memberships_league_id
  ON league_memberships(league_id);
CREATE INDEX IF NOT EXISTS idx_league_memberships_user_id
  ON league_memberships(user_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_predictions_updated_at ON predictions;
CREATE TRIGGER update_predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
