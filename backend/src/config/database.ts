import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'premier_league_predictions',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

export const connectDatabase = async (): Promise<void> => {
  try {
    await pool.connect();
    console.log('Connected to PostgreSQL database');
  } catch (error: any) {
    console.error('Database connection error:', error.message);
    process.exit(1);
  }
};

pool.on('error', (error: any) => {
  console.error('Unexpected error on idle client', error);
  process.exit(-1);
});