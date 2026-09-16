import crypto from "crypto";
import fs from "fs";
import path from "path";
import { PoolClient } from "pg";
import { pool } from "../config/database";

const MIGRATION_LOCK = "premier-league-predictions:migrations";
const migrationsDir = path.join(__dirname, "../../database/migrations");
const seedsDir = path.join(__dirname, "../../database/seeds");
const resetFile = path.join(__dirname, "../../database/reset/development.sql");

const requiredSchema: Record<string, string[]> = {
  users: ["id", "username", "email", "password", "is_admin", "created_at", "updated_at"],
  teams: ["id", "name", "abbreviation", "logo_url", "created_at", "updated_at"],
  fixtures: [
    "id",
    "home_team_id",
    "away_team_id",
    "match_date",
    "deadline",
    "gameweek",
    "status",
    "home_score",
    "away_score",
  ],
  predictions: [
    "id",
    "user_id",
    "fixture_id",
    "predicted_home_score",
    "predicted_away_score",
    "points",
    "is_double",
  ],
  leagues: ["id", "name", "join_code", "created_by"],
  league_memberships: ["id", "league_id", "user_id", "joined_at"],
};

interface Migration {
  name: string;
  sql: string;
  checksum: string;
}

interface AppliedMigration {
  name: string;
  checksum: string;
}

function loadSqlFiles(directory: string): Migration[] {
  if (!fs.existsSync(directory)) return [];

  return fs
    .readdirSync(directory)
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
    .map((name) => {
      const sql = fs.readFileSync(path.join(directory, name), "utf8");
      return {
        name,
        sql,
        checksum: crypto.createHash("sha256").update(sql).digest("hex"),
      };
    });
}

async function withMigrationLock<T>(
  action: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query(
      "SELECT pg_advisory_lock(hashtext($1)::bigint)",
      [MIGRATION_LOCK]
    );
    return await action(client);
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext($1)::bigint)", [MIGRATION_LOCK])
      .catch(() => undefined);
    client.release();
  }
}

async function ensureLedger(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getApplied(client: PoolClient): Promise<AppliedMigration[]> {
  const result = await client.query<AppliedMigration>(
    "SELECT name, checksum FROM schema_migrations ORDER BY name"
  );
  return result.rows;
}

async function hasExistingApplicationSchema(
  client: PoolClient
): Promise<boolean> {
  const result = await client.query<{ count: string }>(
    `
      SELECT COUNT(*)::text AS count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [Object.keys(requiredSchema)]
  );
  return Number(result.rows[0].count) > 0;
}

async function validateExistingSchema(client: PoolClient): Promise<void> {
  const result = await client.query<{ table_name: string; column_name: string }>(
    `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [Object.keys(requiredSchema)]
  );

  const columnsByTable = new Map<string, Set<string>>();
  for (const row of result.rows) {
    const columns = columnsByTable.get(row.table_name) ?? new Set<string>();
    columns.add(row.column_name);
    columnsByTable.set(row.table_name, columns);
  }

  const missing: string[] = [];
  for (const [table, columns] of Object.entries(requiredSchema)) {
    const existingColumns = columnsByTable.get(table);
    if (!existingColumns) {
      missing.push(`${table} (table)`);
      continue;
    }
    for (const column of columns) {
      if (!existingColumns.has(column)) missing.push(`${table}.${column}`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Existing database does not match the expected baseline. Missing: ${missing.join(
        ", "
      )}`
    );
  }
}

function verifyAppliedChecksums(
  migrations: Migration[],
  applied: AppliedMigration[]
): void {
  const migrationByName = new Map(migrations.map((migration) => [migration.name, migration]));
  for (const record of applied) {
    const migration = migrationByName.get(record.name);
    if (!migration) {
      throw new Error(`Applied migration file is missing: ${record.name}`);
    }
    if (migration.checksum !== record.checksum) {
      throw new Error(
        `Applied migration was modified after execution: ${record.name}`
      );
    }
  }
}

export async function migrate(options: {
  baselineExisting?: boolean;
} = {}): Promise<void> {
  await withMigrationLock(async (client) => {
    const migrations = loadSqlFiles(migrationsDir);
    if (migrations.length === 0) throw new Error("No migration files found");

    await ensureLedger(client);
    let applied = await getApplied(client);
    const existingSchema = await hasExistingApplicationSchema(client);

    if (existingSchema && applied.length === 0) {
      if (!options.baselineExisting) {
        throw new Error(
          "Existing application tables found without migration history. Back up the database, then run `npm run migrate:baseline`."
        );
      }

      await validateExistingSchema(client);
      const baseline = migrations[0];
      await client.query(
        "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
        [baseline.name, baseline.checksum]
      );
      console.log(`Baselined existing schema as ${baseline.name}`);
      applied = await getApplied(client);
    }

    verifyAppliedChecksums(migrations, applied);
    const appliedNames = new Set(applied.map((record) => record.name));

    for (const migration of migrations) {
      if (appliedNames.has(migration.name)) continue;

      await client.query("BEGIN");
      try {
        await client.query(migration.sql);
        await client.query(
          "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
          [migration.name, migration.checksum]
        );
        await client.query("COMMIT");
        console.log(`Applied ${migration.name}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  });
}

export async function migrationStatus(): Promise<{
  applied: string[];
  pending: string[];
}> {
  return withMigrationLock(async (client) => {
    const migrations = loadSqlFiles(migrationsDir);
    await ensureLedger(client);
    const applied = await getApplied(client);
    verifyAppliedChecksums(migrations, applied);
    const appliedNames = new Set(applied.map((record) => record.name));

    return {
      applied: applied.map((record) => record.name),
      pending: migrations
        .filter((migration) => !appliedNames.has(migration.name))
        .map((migration) => migration.name),
    };
  });
}

export async function assertDatabaseMigrated(): Promise<void> {
  const client = await pool.connect();
  try {
    const ledger = await client.query<{ ledger: string | null }>(
      "SELECT to_regclass('public.schema_migrations')::text AS ledger"
    );
    if (!ledger.rows[0].ledger) {
      throw new Error(
        "Database has not been migrated. Run `npm run migrate` for a fresh database or `npm run migrate:baseline` for an existing one."
      );
    }

    const migrations = loadSqlFiles(migrationsDir);
    const applied = await getApplied(client);
    verifyAppliedChecksums(migrations, applied);
    const appliedNames = new Set(applied.map((record) => record.name));
    const pending = migrations.filter(
      (migration) => !appliedNames.has(migration.name)
    );
    if (pending.length > 0) {
      throw new Error(
        `Pending database migrations: ${pending
          .map((migration) => migration.name)
          .join(", ")}`
      );
    }
  } finally {
    client.release();
  }
}

export async function seedDatabase(): Promise<void> {
  await withMigrationLock(async (client) => {
    const seeds = loadSqlFiles(seedsDir);
    await client.query("BEGIN");
    try {
      for (const seed of seeds) {
        await client.query(seed.sql);
        console.log(`Seeded ${seed.name}`);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });
}

export async function resetDevelopmentDatabase(): Promise<void> {
  const databaseName =
    process.env.DB_NAME ??
    (process.env.DATABASE_URL
      ? new URL(process.env.DATABASE_URL).pathname.slice(1)
      : "");
  const isDevelopment = process.env.NODE_ENV === "development";
  const isDisposableName = /(_dev|_test)$/.test(databaseName);

  if (!isDevelopment || !isDisposableName) {
    throw new Error(
      "Database reset is only allowed with NODE_ENV=development and a database name ending in _dev or _test."
    );
  }

  const sql = fs.readFileSync(resetFile, "utf8");
  await withMigrationLock(async (client) => {
    await client.query(sql);
    console.log(`Reset development database ${databaseName}`);
  });
}

export async function closeMigrationPool(): Promise<void> {
  await pool.end();
}
