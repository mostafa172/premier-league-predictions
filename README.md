# Premier League Predictions

Premier League prediction game with gameweek score picks, a double-points
selection, global and private-league leaderboards, and admin-managed fixtures.
Built with Angular, Express/TypeScript, and PostgreSQL.

## Local development with Docker

Requirements: Docker Desktop with Docker Compose.

```bash
cp .env.example .env
```

Replace `JWT_SECRET` and `DB_PASSWORD` in `.env`, then start the stack:

```bash
docker compose up --build
```

- Frontend: http://localhost:4200
- Backend health: http://localhost:3000/api/health
- PostgreSQL: localhost:5432

The `migrate` service waits for PostgreSQL, applies pending migrations, and
idempotently seeds the Premier League teams before the API starts. Source files
are bind-mounted for development reloads. Database data is retained in the
`postgres_data` volume.

```bash
docker compose down
docker compose down -v # Also deletes the disposable local database
```

## Native development

Use Node.js 20 and PostgreSQL 16. Create a root `.env` from `.env.example`, then:

```bash
cd backend
npm install
npm run migrate
npm run db:seed
npm run dev
```

In another terminal:

```bash
cd frontend
npm install
npm start
```

## Database migrations

SQL migrations in `backend/database/migrations` are the only schema authority.
They are forward-only, ordered by filename, transactional, checksum-verified,
and tracked in the `schema_migrations` table. Application startup checks that
all migrations are applied; Sequelize does not create or alter tables.

From `backend`:

```bash
npm run migrate          # Apply pending migrations to a fresh/tracked database
npm run migrate:status   # Show applied and pending migrations
npm run db:seed          # Idempotently update team reference data
```

Never edit a migration after it has been applied. Add a new numbered migration
for every schema change.

### Adopting an existing database

The first migration run intentionally refuses an existing database without
migration history. Preserve production data with this process:

1. Back up the database:

   ```bash
   pg_dump "$DATABASE_URL" --format=custom --file=premier-league-backup.dump
   ```

2. Check that the backup file exists and is non-empty.
3. Point the backend environment at the existing database.
4. Validate and record the current schema baseline:

   ```bash
   npm run migrate:baseline
   npm run migrate:status
   ```

The baseline command validates required tables and columns. It records the
baseline without running schema SQL or changing users, fixtures, results,
predictions, points, leagues, or memberships.

### Development-only reset

```bash
NODE_ENV=development DB_NAME=premier_league_predictions_dev npm run db:reset
```

Reset is rejected unless `NODE_ENV=development` and the database name ends in
`_dev` or `_test`. It must never be used against hosted data.

## Environment variables

- `JWT_SECRET`: required long random signing secret
- `DATABASE_URL`: hosted PostgreSQL connection string, or use the `DB_*` values
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `PORT`: backend port, defaults to `3000`
- `NODE_ENV`: `development` or `production`
