import "./env";

export const DATABASE_URL = process.env.DATABASE_URL?.trim();

const password = process.env.DB_PASSWORD?.trim();
if (!DATABASE_URL && !password) {
  throw new Error(
    "DB_PASSWORD is required when DATABASE_URL is not set."
  );
}

export const DATABASE_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: Number.parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "premier_league_predictions_dev",
  user: process.env.DB_USER || "postgres",
  password: password as string,
};
