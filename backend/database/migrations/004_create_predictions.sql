/* filepath: backend/database/migrations/004_create_predictions.sql */
-- Drop table if exists
DROP TABLE IF EXISTS predictions CASCADE;

-- Create predictions table
CREATE TABLE predictions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fixture_id INTEGER NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
    predicted_home_score INTEGER NOT NULL CHECK (predicted_home_score >= 0 AND predicted_home_score <= 20),
    predicted_away_score INTEGER NOT NULL CHECK (predicted_away_score >= 0 AND predicted_away_score <= 20),
    points INTEGER DEFAULT 0 CHECK (points >= 0),
    is_double BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(user_id, fixture_id) -- One prediction per user per fixture
);

-- Create indexes
CREATE INDEX idx_predictions_user_id ON predictions(user_id);
CREATE INDEX idx_predictions_fixture_id ON predictions(fixture_id);
CREATE INDEX idx_predictions_points ON predictions(points);
CREATE INDEX idx_predictions_is_double ON predictions(is_double);
CREATE INDEX idx_predictions_created_at ON predictions(created_at);

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_predictions_updated_at 
    BEFORE UPDATE ON predictions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE predictions IS 'User predictions for Premier League fixtures';