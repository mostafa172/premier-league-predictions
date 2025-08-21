/* filepath: backend/database/migrations/002_create_teams.sql */
-- Drop table if exists
DROP TABLE IF EXISTS teams CASCADE;

-- Create teams table
CREATE TABLE teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    abbreviation VARCHAR(3) NOT NULL UNIQUE,
    logo_url VARCHAR(255),
    color_primary VARCHAR(7), -- hex color
    color_secondary VARCHAR(7), -- hex color
    founded_year INTEGER,
    stadium VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_teams_name ON teams(name);
CREATE INDEX idx_teams_abbreviation ON teams(abbreviation);

COMMENT ON TABLE teams IS 'Premier League teams master data';
COMMENT ON COLUMN teams.color_primary IS 'Primary team color in hex format';
COMMENT ON COLUMN teams.color_secondary IS 'Secondary team color in hex format';