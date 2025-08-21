/* filepath: backend/src/config/sequelize.ts */
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

export const sequelize = new Sequelize({
  database: process.env.DB_NAME || 'premier_league_predictions',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
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

export const connectDatabase = async (): Promise<void> => {
  try {
    // Test the connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');

    // Import all models to register them
    require('../models/User');
    require('../models/Team');
    require('../models/Fixture');
    require('../models/Prediction');
    console.log('📦 Models imported successfully');

    // Set up associations
    const { setupAssociations } = require('../models/associations');
    setupAssociations();
    
    // Sync models (don't force in production)
    await sequelize.sync({ 
      force: false, // Never drop tables in production
      alter: process.env.NODE_ENV === 'development' // Only alter in development
    });
    console.log('✅ Database models synchronized');
    
  } catch (error) {
    console.error('❌ Unable to connect to database:', error);
    throw error;
  }
};