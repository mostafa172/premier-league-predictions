-- Create leagues table
CREATE TABLE IF NOT EXISTS leagues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    join_code VARCHAR(10) UNIQUE NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index on join_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_leagues_join_code ON leagues(join_code);

-- Create index on created_by for faster queries
CREATE INDEX IF NOT EXISTS idx_leagues_created_by ON leagues(created_by);
