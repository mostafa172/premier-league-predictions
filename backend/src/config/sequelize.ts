/* filepath: backend/src/config/sequelize.ts */
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

let sequelize: Sequelize;

// Prefer DATABASE_URL in prod (Neon/Render), fall back to discrete vars in dev
if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      // Neon/hosted PG often require SSL
      ssl: { require: true, rejectUnauthorized: false },
    },
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  });
} else {
  sequelize = new Sequelize({
    database: process.env.DB_NAME || 'premier_league_predictions',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '171397',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: isProd ? false : console.log,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  });
}

export { sequelize };

export const connectDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Register models
    require('../models/User');
    require('../models/Team');
    require('../models/Fixture');
    require('../models/Prediction');
    require('../models/League');
    require('../models/LeagueMembership');

    // Set up associations
    const { setupAssociations } = require('../models/associations');
    setupAssociations();

    await sequelize.sync({
      force: false,
      alter: process.env.NODE_ENV === 'development',
    });

    console.log('✅ Models synchronized');
  } catch (err) {
    console.error('❌ DB connection error:', err);
    throw err;
  }
};