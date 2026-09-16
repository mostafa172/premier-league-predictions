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

## Football data sync

Fixtures, kickoff times and scores can be pulled from
[football-data.org](https://www.football-data.org). Register for a free token
and put it in `.env` as `FOOTBALL_API_KEY`.

Four jobs share one provider adapter, so swapping data sources means writing a
new adapter and nothing else:

| Job | What it does | When it runs |
| --- | --- | --- |
| `teams` | Links competition clubs to our team rows, creating promoted sides | On demand |
| `schedule` | Keeps the current gameweek plus `FOOTBALL_SYNC_GAMEWEEK_HORIZON` ahead in step with the provider | Weekly, and shortly after boot |
| `results` | Marks kicked-off fixtures live from the clock, then records final scores and scores predictions | Every `FOOTBALL_SYNC_RESULTS_INTERVAL_SECONDS` |
| `reconcile` | Settles matches the results poller never saw finish, for instance while the app was down | Hourly |
| `h2h` | Caches previous meetings for fixtures still open for predictions | Daily, and shortly after boot |

### Scores are only written at full time

A score in this app means the match is over, so nothing records a running
score. That shapes the polling:

- **Kickoff** moves a fixture to live using the clock alone. No API call is
  involved, so predictions lock and the UI shows the match in progress for
  free.
- **While the match is played** the provider is not contacted at all.
- **From `FOOTBALL_FINISH_WINDOW_START_MINUTES` after kickoff** the poller
  starts looking for a final result, and stops once the match is final or
  `FOOTBALL_FINISH_WINDOW_END_MINUTES` passes.
- **Full time** writes the score, flips the fixture to finished and scores its
  predictions in one step.

One request covers every match that kicked off in the same window, because the
provider returns a competition's matches by date. A ten-match Saturday
therefore costs the same as a single match, and a typical matchweek settles in
well under fifty requests against a limit of ten per minute.

Run any job by hand, against any competition the token covers:

```bash
npm run sync -- schedule --dry-run          # preview, writes nothing
npm run sync -- teams
npm run sync -- schedule
npm run sync -- results
npm run sync -- schedule --competition CL --dry-run   # Champions League
```

Admins can also trigger a job over HTTP and read the audit trail:

```
POST /api/admin/sync/:job    body: { "dryRun": true }
GET  /api/admin/sync/runs
```

Every run, manual or scheduled, is recorded in the `sync_runs` table with
counts, warnings and any error.

### Head to head

Prediction cards that are still open show five small dots, one per previous
meeting between the two clubs, oldest on the left. Tapping them opens the
record and the five dated results.

The data is cached rather than fetched per view, which matters because a
pairing is read by every user who opens the gameweek but only changes when the
two clubs meet again:

- The `h2h` job fills the cache for open fixtures, one request per pairing.
- Finishing a fixture drops that pairing's row, so it is refetched before the
  clubs next meet.
- The page reads `GET /api/fixtures/head-to-head/gameweek/:gameweek`, one
  request for the whole gameweek, always served from the database.

Two provider quirks are worth knowing. Its `limit` parameter is a lookback
over recent matches rather than a count of meetings, so asking for five can
return fewer than exist; we ask wide and keep the newest five. And its
`aggregates` block has been seen disagreeing with the matches it ships
alongside, so the record is computed from the meetings themselves.

Some pairings legitimately have no history: the archive reaches back about five
years, so newly promoted clubs return nothing. Those cards simply show no dots.

### What the sync will not do

Played football is never rewritten, so a synced season cannot disturb finished
gameweeks or the points already awarded for them:

- A fixture with a final score is never modified, and its predictions are never
  rescored.
- No score is ever written before full time, not even a half time score.
- Gameweeks behind the provider's current one are left alone.
- Matches already played are not imported at all unless you pass `--backfill`.
- A fixture you entered by hand is adopted rather than duplicated, matched on
  its two clubs, after which the provider keeps its kickoff time accurate.
- Postponements and cancellations are reported as warnings for you to act on
  rather than applied automatically.
- Clubs keep our names, three-letter codes and local logo files; the sync only
  stamps the provider's id onto them.

Scheduled jobs stay off until `FOOTBALL_SYNC_ENABLED=true`. The CLI works
either way, which makes a dry run the safe way to see what a job would do.

## Deploying

The backend refuses to start while a migration is pending, so deploys must
migrate before booting. `npm start` does exactly that:

```bash
npm install && npm run build   # build command
npm start                      # start command: migrates, then serves
```

`migrate:deploy` runs the migrator in baseline mode, which covers all three
cases without any thinking at deploy time:

- a fresh database gets every migration applied;
- a database that already has the application tables but no migration history
  is adopted, recording the baseline without rewriting the schema;
- a database that is already tracked simply gets whatever is pending.

These scripts run the compiled output rather than `ts-node`, which lives in
devDependencies and is not available on a production install.

Two things to know about scheduled syncs in hosted environments. Instances
that sleep when idle only run jobs while awake, so a free tier needs something
pinging `/api/health` every few minutes for the results poller to fire on time;
without it the hourly reconcile job catches up whenever the service next wakes.
And `FOOTBALL_SYNC_ENABLED` should be true in exactly one environment per
database, since two schedulers on one database will contend for the same
advisory lock and waste the rate limit.

The frontend's API URL is baked in at build time. Vercel picks the right one
by itself through the `vercel-build` script: production deploys build the
`production` configuration, and every preview branch builds `staging`, which
points at the staging API. Neither needs a dashboard setting, though a build
command configured in the Vercel project would override it.

### Staging

`render.yaml` describes a staging backend only. Production was created through
the dashboard, and a blueprint that also described it could reconcile settings
on a live service, so it is deliberately left out until staging has proven
itself.

Setting it up once:

1. Branch the production database in Neon. The branch starts as a copy, so
   staging exercises real users, predictions and fixtures without any risk to
   them.
2. In Render, apply the blueprint and set the three secrets it leaves empty:
   `DATABASE_URL` pointing at the Neon branch, `JWT_SECRET`, and
   `FOOTBALL_API_KEY`.
3. Confirm the host Render assigns matches
   `frontend/src/environments/environment.staging.ts`, and correct it if not.
4. Point an uptime pinger at `/api/health` every five minutes, otherwise the
   free instance sleeps and the results poller misses kickoffs.

On first boot the migrator adopts the branched database: it records the
baseline without rewriting the schema, then applies the migrations the branch
adds. Nothing has to be reset by hand.

Before letting a sync write anything, read what it would do:

```bash
npm run sync:prod -- schedule --dry-run
npm run sync:prod -- teams --dry-run
```

`FOOTBALL_SYNC_ENABLED` should stay true in exactly one environment per
database. Staging and production also share one API token, so enabling the
scheduled jobs in both would spend a single rate limit budget twice.

## Environment variables

- `JWT_SECRET`: required long random signing secret
- `DATABASE_URL`: hosted PostgreSQL connection string, or use the `DB_*` values
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `PORT`: backend port, defaults to `3000`
- `NODE_ENV`: `development` or `production`
- `FOOTBALL_API_KEY`: football-data.org token, required for any sync
- `FOOTBALL_SYNC_ENABLED`: run the scheduled jobs, defaults to `false`
- `FOOTBALL_COMPETITION`: competition code the jobs use, defaults to `PL`
- `FOOTBALL_SEASON`: season start year, blank means the provider's active season
- `FOOTBALL_SYNC_GAMEWEEK_HORIZON`: gameweeks kept ahead, defaults to `3`
- `FOOTBALL_SYNC_RESULTS_INTERVAL_SECONDS`: results poll interval, defaults to `300`
- `FOOTBALL_FINISH_WINDOW_START_MINUTES`: minutes after kickoff before polling
  for a final result, defaults to `95`
- `FOOTBALL_FINISH_WINDOW_END_MINUTES`: minutes after kickoff to give up and
  leave it to reconcile, defaults to `240`
- `FOOTBALL_SYNC_H2H_CRON`: when the head to head cache tops up, defaults to
  `40 5 * * *`
- `FOOTBALL_H2H_MAX_REQUESTS_PER_RUN`: pairings fetched per run so a cold cache
  spreads over several runs, defaults to `15`

If your machine routes traffic through a TLS-inspecting proxy, containers need
its root CA or every API call fails with `unable to get local issuer
certificate`. Put the mount in a `compose.override.yaml`, which is gitignored.
