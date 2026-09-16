/* filepath: backend/src/config/sequelize.ts */
import { Sequelize } from 'sequelize';
import { assertDatabaseMigrated } from '../database/migrator';
import { DATABASE_CONFIG, DATABASE_URL } from './database-env';

const isProd = process.env.NODE_ENV === 'production';

let sequelize: Sequelize;

// Prefer DATABASE_URL in prod (Neon/Render), fall back to discrete vars in dev
if (DATABASE_URL) {
  sequelize = new Sequelize(DATABASE_URL, {
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
    database: DATABASE_CONFIG.database,
    username: DATABASE_CONFIG.user,
    password: DATABASE_CONFIG.password,
    host: DATABASE_CONFIG.host,
    port: DATABASE_CONFIG.port,
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
    require('../models/SyncRun');

    // Set up associations
    const { setupAssociations } = require('../models/associations');
    setupAssociations();

    await assertDatabaseMigrated();
    console.log('✅ Database migrations are current');
  } catch (err) {
    console.error('❌ DB connection error:', err);
    throw err;
  }
};