/**
 * Importing a model builds the Sequelize instance, which insists on database
 * settings even though the suite never connects. These values are throwaway.
 */
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test-password';
process.env.DB_NAME = process.env.DB_NAME || 'test-db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.FOOTBALL_API_KEY = process.env.FOOTBALL_API_KEY || 'test-token';
process.env.NODE_ENV = 'test';
