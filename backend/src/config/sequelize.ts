import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

let sequelize: Sequelize;

if (process.env.DATABASE_URL) {
  // Production: use DATABASE_URL string directly
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // needed for Neon/Supabase free tiers
      },
    },
  });
} else {
  // Local development
  sequelize = new Sequelize({
    database: process.env.DB_NAME || 'premier_league_predictions',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '171397',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  });
}

export { sequelize };