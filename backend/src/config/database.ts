// backend/src/config/database.ts
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const useUrl = !!process.env.DATABASE_URL;

export const pool = useUrl
  ? new Pool({
      connectionString: process.env.DATABASE_URL, // Neon
      ssl: { rejectUnauthorized: false },         // required by Neon
    })
  : new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'premier_league_predictions',
      password: process.env.DB_PASSWORD || 'password',
      port: parseInt(process.env.DB_PORT || '5432', 10),
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