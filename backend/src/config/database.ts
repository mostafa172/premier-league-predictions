// backend/src/config/database.ts
import { Pool } from 'pg';
import { DATABASE_CONFIG, DATABASE_URL } from './database-env';

const useUrl = Boolean(DATABASE_URL);

export const pool = useUrl
  ? new Pool({
      connectionString: DATABASE_URL, // Neon
      ssl: { rejectUnauthorized: false },         // required by Neon
    })
  : new Pool({
      ...DATABASE_CONFIG,
    });

export const connectDatabase = async (): Promise<void> => {
  try {
    const client = await pool.connect();
    const db = (await client.query('select current_database() as db')).rows[0].db;
    console.log('✅ Connected pg Pool. Source =', useUrl ? 'DATABASE_URL' : 'DB_*', 'DB =', db);
    client.release();
  } catch (error: any) {
    console.error('Database connection error (pg Pool):', error.message);
    process.exit(1);
  }
};

pool.on('error', (error: any) => {
  console.error('Unexpected error on idle client', error);
  process.exit(-1);
});