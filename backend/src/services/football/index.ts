import { pool } from '../../config/database';
import { FOOTBALL_CONFIG } from '../../config/football';
import { SyncJob } from '../../models/SyncRun';
import { FootballProvider, createFootballProvider } from '../../integrations/football';
import { SyncReport, createReport, withSyncRun } from './sync-report';
import { syncSchedule } from './schedule-sync.service';
import {
  syncResults,
  syncReconcile,
  syncResultVerification,
  findResultVerificationCandidates,
} from './result-sync.service';
import { syncTeams } from './team-mapping.service';
import { H2H_LIMIT, warmHeadToHead } from './h2h.service';

export * from './sync-report';
export { syncSchedule, isFrozen, matchLabel } from './schedule-sync.service';
export {
  syncResults,
  syncReconcile,
  syncResultVerification,
  applyMatchResult,
  applyVerifiedMatchResult,
  promoteKickedOffFixtures,
} from './result-sync.service';
export {
  syncTeams,
  TeamResolver,
  normalizeTeamName,
  displayTeamName,
} from './team-mapping.service';
export {
  warmHeadToHead,
  invalidateHeadToHead,
  headToHeadForGameweek,
  summarizeMeetings,
  toMeetings,
  H2H_LIMIT,
} from './h2h.service';
export type { H2HSummary, H2HMeetingView, H2HOutcome } from './h2h.service';

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
 * Only one process may run a given job at a time, otherwise two runs write the
 * same rows and spend the same rate limit budget twice.
 *
 * The lock is taken on a single dedicated client rather than through the
 * Sequelize pool: advisory locks belong to a session, so acquiring on one
 * pooled connection and releasing on another leaks the lock and stops every
 * later run.
 */
const withJobLock = async <T>(
  job: SyncJob,
  action: () => Promise<T>
): Promise<T | null> => {
  const key = `football-sync:${job}`;
  const client = await pool.connect();

  try {
    const { rows } = await client.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock(hashtext($1)::bigint) AS locked',
      [key]
    );

    if (!rows[0]?.locked) {
      console.log(`⏭️  ${job} sync already running elsewhere, skipping this tick`);
      return null;
    }

    try {
      return await action();
    } finally {
      await client
        .query('SELECT pg_advisory_unlock(hashtext($1)::bigint)', [key])
        .catch(() => undefined);
    }
  } finally {
    client.release();
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

  // This job wakes frequently to stay inside the 1–2 minute confirmation
  // window. Do not create an empty audit row on every idle tick.
  if (job === SyncJob.VERIFY_RESULTS) {
    const due = await findResultVerificationCandidates(
      provider.name,
      new Date(),
      {
        dryRun,
        season,
        delaySeconds: FOOTBALL_CONFIG.resultVerificationDelaySeconds,
        lookbackHours: FOOTBALL_CONFIG.reconcileLookbackHours,
      }
    );
    if (due.length === 0) return report;
  }

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

        case SyncJob.VERIFY_RESULTS:
          await syncResultVerification(provider, competition, report, {
            dryRun,
            season,
            delaySeconds: FOOTBALL_CONFIG.resultVerificationDelaySeconds,
            lookbackHours: FOOTBALL_CONFIG.reconcileLookbackHours,
          });
          break;

        case SyncJob.H2H:
          await warmHeadToHead(provider, report, {
            dryRun,
            limit: H2H_LIMIT,
            maxRequests: FOOTBALL_CONFIG.h2hMaxRequestsPerRun,
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
