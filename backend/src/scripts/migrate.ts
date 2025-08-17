-- Active: 1750319878836@@127.0.0.1@5432@premier_league_predictions
import { pool } from '../config/database';
import fs from 'fs';
import path from 'path';

const runMigrations = async () => {
  try {
    console.log('Running database migrations...');
    
    // Read migration files
    const migrationsDir = path.join(__dirname, '../../database/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).sort();
    
    for (const file of migrationFiles) {
      if (file.endsWith('.sql')) {
        console.log(`Running migration: ${file}`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');
        await pool.query(sql);
        console.log(`✓ ${file} completed`);
      }
    }
    
    console.log('All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigrations();