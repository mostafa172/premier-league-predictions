import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // for Neon/Supabase
    })
  : new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'premier_league_predictions',
      password: process.env.DB_PASSWORD || '171397',
      port: parseInt(process.env.DB_PORT || '5432'),
    });

export const connectDatabase = async (): Promise<void> => {
  try {
    await pool.connect();
    console.log('✅ Connected to PostgreSQL database');
  } catch (error: any) {
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};