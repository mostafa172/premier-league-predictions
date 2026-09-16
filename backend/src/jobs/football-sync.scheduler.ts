import cron from 'node-cron';
import { FOOTBALL_CONFIG } from '../config/football';
import { SyncJob } from '../models/SyncRun';
import { runSyncJob, summarize } from '../services/football';

let started = false;

/**
 * A failing sync must never take the API process down, so every tick swallows
 * its error after logging it. Details land in the sync_runs ledger.
 */
const safeRun = async (job: SyncJob): Promise<void> => {
  try {
    const report = await runSyncJob(job);
    if (!report) return;

    const touched =
      report.created > 0 ||
      report.updated > 0 ||
      report.predictionsScored > 0 ||
      report.warnings.length > 0;

    if (touched) console.log(`⚽ ${summarize(report)}`);
  } catch (error) {
    console.error(
      `❌ ${job} sync failed:`,
      error instanceof Error ? error.message : error
    );
  }
};

export const startFootballSync = (): void => {
  if (!FOOTBALL_CONFIG.syncEnabled) {
    console.log('⏸️  Football sync off (set FOOTBALL_SYNC_ENABLED=true to run it)');
    return;
  }

  if (!FOOTBALL_CONFIG.apiKey) {
    console.warn('⚠️  Football sync enabled but FOOTBALL_API_KEY is empty; not starting');
    return;
  }

  if (started) return;
  started = true;

  cron.schedule(FOOTBALL_CONFIG.scheduleCron, () => void safeRun(SyncJob.SCHEDULE));
  cron.schedule(FOOTBALL_CONFIG.reconcileCron, () => void safeRun(SyncJob.RECONCILE));

  // The results poller gates itself on the finish window, so ticks outside a
  // match's closing minutes cost nothing but a local query.
  setInterval(
    () => void safeRun(SyncJob.RESULTS),
    Math.max(FOOTBALL_CONFIG.resultsIntervalSeconds, 30) * 1000
  ).unref();

  // Catch up shortly after boot so a restart refreshes the schedule.
  setTimeout(() => void safeRun(SyncJob.SCHEDULE), 10_000).unref();

  console.log(
    `⚽ Football sync started for ${FOOTBALL_CONFIG.competition}: ` +
      `schedule "${FOOTBALL_CONFIG.scheduleCron}", ` +
      `reconcile "${FOOTBALL_CONFIG.reconcileCron}", ` +
      `results every ${FOOTBALL_CONFIG.resultsIntervalSeconds}s ` +
      `(only ${FOOTBALL_CONFIG.finishWindowStartMinutes}-` +
      `${FOOTBALL_CONFIG.finishWindowEndMinutes} min after a kickoff)`
  );
};
