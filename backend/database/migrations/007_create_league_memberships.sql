-- Create league_memberships table
CREATE TABLE IF NOT EXISTS league_memberships (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(league_id, user_id) -- Prevent duplicate memberships
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_league_memberships_league_id ON league_memberships(league_id);
CREATE INDEX IF NOT EXISTS idx_league_memberships_user_id ON league_memberships(user_id);
