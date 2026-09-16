import '../config/env';
import { connectDatabase, sequelize } from '../config/sequelize';
import { FOOTBALL_CONFIG } from '../config/football';
import { SyncJob } from '../models/SyncRun';
import { runSyncJob, summarize, SyncReport } from '../services/football';

const JOBS: Record<string, SyncJob> = {
  teams: SyncJob.TEAMS,
  schedule: SyncJob.SCHEDULE,
  results: SyncJob.RESULTS,
  live: SyncJob.RESULTS,
  reconcile: SyncJob.RECONCILE,
};

const USAGE = `
Usage: npm run sync -- <job> [options]

Jobs
  teams       Link competition clubs to local teams, creating missing ones
  schedule    Upsert fixtures for the current gameweek window
  results     Mark kicked-off fixtures live, then settle finished matches
  reconcile   Settle matches the results poller never saw finish

Options
  --dry-run              Report what would change without writing
  --competition <CODE>   Competition code (default ${FOOTBALL_CONFIG.competition}, e.g. CL, BL1, SA)
  --season <YEAR>        Season start year (default: provider's active season)
  --horizon <N>          Gameweeks ahead of the current one (default ${FOOTBALL_CONFIG.gameweekHorizon})
  --backfill             Also import matches that have already been played
`;

interface Args {
  job: SyncJob;
  dryRun: boolean;
  competition?: string;
  season?: string;
  horizon?: number;
  backfillFinished?: boolean;
}

const parseArgs = (argv: string[]): Args => {
  const [jobName, ...rest] = argv;
  const job = JOBS[(jobName || '').toLowerCase()];

  if (!job) {
    throw new Error(
      `Unknown job "${jobName || ''}". Expected one of: ${Object.keys(JOBS).join(', ')}`
    );
  }

  const args: Args = { job, dryRun: false };

  for (let i = 0; i < rest.length; i += 1) {
    const flag = rest[i];
    const value = rest[i + 1];

    switch (flag) {
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--backfill':
        args.backfillFinished = true;
        break;
      case '--competition':
        args.competition = value;
        i += 1;
        break;
      case '--season':
        args.season = value;
        i += 1;
        break;
      case '--horizon':
        args.horizon = Number.parseInt(value, 10);
        i += 1;
        break;
      default:
        throw new Error(`Unknown option "${flag}"`);
    }
  }

  return args;
};

const ICONS: Record<string, string> = {
  create: '🆕',
  update: '🔁',
  adopt: '🔗',
  skip: '⏭️ ',
  score: '🎯',
  team: '👕',
};

const print = (report: SyncReport): void => {
  console.log('');
  if (report.changes.length === 0) {
    console.log('No changes.');
  } else {
    const width = Math.max(
      ...report.changes.map((change) => change.label.length)
    );
    for (const change of report.changes) {
      console.log(
        `${ICONS[change.action] || '•'} ${change.label.padEnd(width)}  ${change.detail}`
      );
    }
  }

  if (report.warnings.length > 0) {
    console.log('\nWarnings');
    report.warnings.forEach((warning) => console.log(`  ⚠️  ${warning}`));
  }

  console.log(`\n${summarize(report)}`);
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));

  // Sequelize echoes every query outside production, which buries the report.
  (sequelize as unknown as { options: { logging: unknown } }).options.logging =
    false;

  await connectDatabase();

  const report = await runSyncJob(args.job, {
    dryRun: args.dryRun,
    competition: args.competition,
    season: args.season,
    horizon: args.horizon,
    backfillFinished: args.backfillFinished,
  });

  if (!report) {
    console.log('Another process holds the job lock; nothing ran.');
    return;
  }

  print(report);
};

main()
  .then(async () => {
    await sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error(`\n❌ ${error instanceof Error ? error.message : error}`);
    if (error instanceof Error && /Unknown (job|option)/.test(error.message)) {
      console.log(USAGE);
    }
    await sequelize.close().catch(() => undefined);
    process.exit(1);
  });
