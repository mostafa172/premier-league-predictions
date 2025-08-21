/* filepath: backend/database/migrations/000_drop_all_tables.sql */
-- Drop all tables and types
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS fixtures CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS fixture_status CASCADE;

-- Drop any sequences that might be left
DROP SEQUENCE IF EXISTS users_id_seq CASCADE;
DROP SEQUENCE IF EXISTS teams_id_seq CASCADE;
DROP SEQUENCE IF EXISTS fixtures_id_seq CASCADE;
DROP SEQUENCE IF EXISTS predictions_id_seq CASCADE;

SELECT 'All tables and types dropped successfully' as status;