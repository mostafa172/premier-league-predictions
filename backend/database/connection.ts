/* filepath: backend/src/database/connection.ts */
import pgPromise from 'pg-promise';
import dotenv from 'dotenv';

dotenv.config();

const pgp = pgPromise();

const connection = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'premier_league_predictions',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
};

// Export as named export 'db'
export const db = pgp(connection);

// Also export as default if needed elsewhere
export default db;

// Test connection
db.connect()
  .then((obj) => {
    console.log('✅ Database connected successfully');
    obj.done(); // success, release connection
  })
  .catch((error) => {
    console.error('❌ Database connection error:', error);
  });