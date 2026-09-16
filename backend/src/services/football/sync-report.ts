import { SyncJob, SyncRun, SyncRunStatus } from '../../models/SyncRun';

export type SyncAction =
  | 'create'
  | 'update'
  | 'adopt'
  | 'skip'
  | 'score'
  | 'team';

export interface SyncChange {
  action: SyncAction;
  /** Short human label, e.g. "GW5 BRE vs CHE". */
  label: string;
  detail: string;
}

export interface SyncReport {
  job: SyncJob;
  provider: string;
  competition: string;
  dryRun: boolean;
  created: number;
  updated: number;
  skipped: number;
  predictionsScored: number;
  apiRequests: number;
  warnings: string[];
  changes: SyncChange[];
}

export const createReport = (
  job: SyncJob,
  provider: string,
  competition: string,
  dryRun: boolean
): SyncReport => ({
  job,
  provider,
  competition,
  dryRun,
  created: 0,
  updated: 0,
  skipped: 0,
  predictionsScored: 0,
  apiRequests: 0,
  warnings: [],
  changes: [],
});

export const record = (
  report: SyncReport,
  action: SyncAction,
  label: string,
  detail: string
): void => {
  report.changes.push({ action, label, detail });

  if (action === 'create' || action === 'team') report.created += 1;
  else if (action === 'update' || action === 'adopt') report.updated += 1;
  else if (action === 'skip') report.skipped += 1;
};

export const warn = (report: SyncReport, message: string): void => {
  if (!report.warnings.includes(message)) report.warnings.push(message);
};

/**
 * Wraps a job so every run lands in sync_runs whether it succeeds or throws.
 * Ledger failures never mask the job's own outcome.
 */
export const withSyncRun = async (
  report: SyncReport,
  run: (report: SyncReport) => Promise<void>
): Promise<SyncReport> => {
  let row: SyncRun | null = null;

  try {
    row = await SyncRun.create({
      job: report.job,
      provider: report.provider,
      competition: report.competition,
      dryRun: report.dryRun,
      status: SyncRunStatus.RUNNING,
      startedAt: new Date(),
    });
  } catch (error) {
    console.error('⚠️  Could not open a sync_runs row:', error);
  }

  const finish = async (
    status: SyncRunStatus,
    error?: unknown
  ): Promise<void> => {
    if (!row) return;
    try {
      await row.update({
        status,
        fixturesCreated: report.created,
        fixturesUpdated: report.updated,
        fixturesSkipped: report.skipped,
        predictionsScored: report.predictionsScored,
        apiRequests: report.apiRequests,
        warnings: report.warnings,
        error: error ? String(error instanceof Error ? error.message : error) : null,
        finishedAt: new Date(),
      });
    } catch (ledgerError) {
      console.error('⚠️  Could not close the sync_runs row:', ledgerError);
    }
  };

  try {
    await run(report);
    await finish(SyncRunStatus.SUCCESS);
    return report;
  } catch (error) {
    await finish(SyncRunStatus.FAILED, error);
    throw error;
  }
};

export const summarize = (report: SyncReport): string => {
  const prefix = report.dryRun ? '[dry-run] ' : '';
  return (
    `${prefix}${report.job}/${report.competition}: ` +
    `${report.created} created, ${report.updated} updated, ` +
    `${report.skipped} skipped, ${report.predictionsScored} predictions scored, ` +
    `${report.apiRequests} api requests, ${report.warnings.length} warnings`
  );
};
