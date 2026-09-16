import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/sequelize';
import { FOOTBALL_CONFIG } from '../../config/football';
import { SyncJob } from '../../models/SyncRun';
import { FootballProvider, createFootballProvider } from '../../integrations/football';
import { SyncReport, createReport, withSyncRun } from './sync-report';
import { syncSchedule } from './schedule-sync.service';
import { syncResults, syncReconcile } from './result-sync.service';
import { syncTeams } from './team-mapping.service';

export * from './sync-report';
export { syncSchedule, isFrozen, matchLabel } from './schedule-sync.service';
export {
  syncResults,
  syncReconcile,
  applyMatchResult,
  promoteKickedOffFixtures,
} from './result-sync.service';
export {
  syncTeams,
  TeamResolver,
  normalizeTeamName,
  displayTeamName,
} from './team-mapping.service';

export interface RunJobOptions {
  dryRun?: boolean;
  competition?: string;
  season?: string;
  horizon?: number;
  /** Let the schedule sync import matches that have already been played. */
  backfillFinished?: boolean;
  /** Injected in tests; production builds one from config. */
  provider?: FootballProvider;
}

/**
 * Only one process should run a given job at a time, otherwise two pollers can
 * both write a result and double-score predictions.
 */
const withJobLock = async <T>(
  job: SyncJob,
  action: () => Promise<T>
): Promise<T | null> => {
  const key = `football-sync:${job}`;
  const [{ locked }] = await sequelize.query<{ locked: boolean }>(
    'SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS locked',
    { bind: [key], type: QueryTypes.SELECT }
  );

  if (!locked) {
    console.log(`⏭️  ${job} sync already running elsewhere, skipping this tick`);
    return null;
  }

  try {
    return await action();
  } finally {
    await sequelize
      .query('SELECT pg_advisory_unlock(hashtext($1)::bigint)', {
        bind: [key],
        type: QueryTypes.SELECT,
      })
      .catch(() => undefined);
  }
};

export const runSyncJob = async (
  job: SyncJob,
  options: RunJobOptions = {}
): Promise<SyncReport | null> => {
  const provider = options.provider ?? createFootballProvider();
  const competition = options.competition || FOOTBALL_CONFIG.competition;
  const dryRun = options.dryRun ?? false;
  const season = options.season ?? (FOOTBALL_CONFIG.season || undefined);

  const report = createReport(job, provider.name, competition, dryRun);

  return withJobLock(job, () =>
    withSyncRun(report, async () => {
      switch (job) {
        case SyncJob.TEAMS:
          await syncTeams(provider, competition, report, { dryRun });
          break;

        case SyncJob.SCHEDULE:
          await syncSchedule(provider, competition, report, {
            dryRun,
            season,
            horizon: options.horizon ?? FOOTBALL_CONFIG.gameweekHorizon,
            backfillFinished: options.backfillFinished ?? false,
          });
          break;

        case SyncJob.RESULTS:
          await syncResults(provider, competition, report, {
            dryRun,
            season,
            finishWindowStartMinutes: FOOTBALL_CONFIG.finishWindowStartMinutes,
            finishWindowEndMinutes: FOOTBALL_CONFIG.finishWindowEndMinutes,
          });
          break;

        case SyncJob.RECONCILE:
          await syncReconcile(provider, competition, report, {
            dryRun,
            season,
            finishWindowStartMinutes: FOOTBALL_CONFIG.finishWindowStartMinutes,
            finishWindowEndMinutes: FOOTBALL_CONFIG.finishWindowEndMinutes,
            lookbackHours: FOOTBALL_CONFIG.reconcileLookbackHours,
          });
          break;

        default:
          throw new Error(`Unknown sync job "${job}"`);
      }

      report.apiRequests = provider.requestCount;
    })
  );
};
