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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, fixture_id) -- One prediction per user per fixture
);

-- Create indexes
CREATE INDEX idx_predictions_user_id ON predictions(user_id);
CREATE INDEX idx_predictions_fixture_id ON predictions(fixture_id);
CREATE INDEX idx_predictions_points ON predictions(points);
CREATE INDEX idx_predictions_is_double ON predictions(is_double);
CREATE INDEX idx_predictions_created_at ON predictions(created_at);

-- Create composite indexes for common queries
CREATE INDEX idx_predictions_user_fixture ON predictions(user_id, fixture_id);
CREATE INDEX idx_predictions_user_points ON predictions(user_id, points);

COMMENT ON TABLE predictions IS 'User predictions for Premier League fixtures';
COMMENT ON COLUMN predictions.points IS 'Points earned: 3 for exact score, 1 for correct result';
COMMENT ON COLUMN predictions.is_double IS 'Double points multiplier applied';
COMMENT ON CONSTRAINT predictions_user_id_fixture_id_key ON predictions IS 'One prediction per user per fixture';