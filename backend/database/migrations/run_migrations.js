/* filepath: backend/database/migrations/run_migrations.js */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'premier_league_predictions',
});

const migrationFiles = [
  '001_create_users.sql',
  '002_create_teams.sql', 
  '003_create_fixtures.sql',
  '004_create_predictions.sql',
  '005_insert_premier_league_teams.sql'
];

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database migrations...\n');
    
    for (const file of migrationFiles) {
      const filePath = path.join(__dirname, file);
      
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Migration file not found: ${file}`);
        continue;
      }
      
      console.log(`📄 Running migration: ${file}`);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      try {
        await client.query(sql);
        console.log(`✅ Migration completed: ${file}\n`);
      } catch (error) {
        console.error(`❌ Migration failed: ${file}`);
        console.error(`Error: ${error.message}\n`);
        throw error;
      }
    }
    
    // Verify migrations
    console.log('🔍 Verifying migrations...');
    
    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📊 Created tables:');
    tables.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });
    
    const teamCount = await client.query('SELECT COUNT(*) as count FROM teams');
    console.log(`\n🏟️  Teams inserted: ${teamCount.rows[0].count}`);
    
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`👥 Users created: ${userCount.rows[0].count}`);
    
    console.log('\n🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migrations
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };