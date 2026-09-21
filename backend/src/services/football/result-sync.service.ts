import { Op } from 'sequelize';
import { Fixture, FixtureStatus } from '../../models/Fixture';
import { Prediction } from '../../models/Prediction';
import { FootballProvider, ProviderMatch } from '../../integrations/football';
import { SyncReport, record, warn } from './sync-report';
import { isFrozen, matchLabel } from './schedule-sync.service';
import { invalidateHeadToHead } from './h2h.service';

export interface ResultSyncOptions {
  dryRun: boolean;
  /**
   * Minutes after kickoff at which a final whistle becomes plausible. Polling
   * starts here rather than at kickoff, because a score is only ever written
   * once the match is over.
   */
  finishWindowStartMinutes: number;
  /** Stop polling this long after kickoff; reconcile handles the remainder. */
  finishWindowEndMinutes: number;
  season?: string;
}

export interface ReconcileOptions extends ResultSyncOptions {
  lookbackHours: number;
}

export interface ResultVerificationOptions {
  dryRun: boolean;
  /** Wait this long after first settlement before trusting a second read. */
  delaySeconds: number;
  /** Ignore old imported/manual history that predates this safety check. */
  lookbackHours: number;
  season?: string;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const SECOND = 1_000;

const utcDay = (date: Date, dayOffset = 0): Date => {
  const shifted = new Date(date.getTime() + dayOffset * 24 * HOUR);
  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate()
    )
  );
};

const fixtureLabel = (fixture: Fixture): string =>
  `GW${fixture.gameweek} fixture #${fixture.id}`;

/**
 * Fixtures old enough to have finished but not yet final for us. Returning an
 * empty list is the normal case and costs zero requests, which is what keeps
 * usage negligible: a match in progress is never polled.
 */
export const findFinishCandidates = async (
  source: string,
  now: Date,
  options: ResultSyncOptions
): Promise<Fixture[]> =>
  Fixture.findAll({
    where: {
      syncSource: source,
      status: { [Op.in]: [FixtureStatus.UPCOMING, FixtureStatus.LIVE] },
      matchDate: {
        [Op.between]: [
          new Date(now.getTime() - options.finishWindowEndMinutes * MINUTE),
          new Date(now.getTime() - options.finishWindowStartMinutes * MINUTE),
        ],
      },
    },
    order: [['matchDate', 'ASC']],
  });

/** Fixtures that should have finished long ago but never got a final score. */
export const findStaleCandidates = async (
  source: string,
  now: Date,
  options: ReconcileOptions
): Promise<Fixture[]> =>
  Fixture.findAll({
    where: {
      syncSource: source,
      status: { [Op.in]: [FixtureStatus.UPCOMING, FixtureStatus.LIVE] },
      matchDate: {
        [Op.between]: [
          new Date(now.getTime() - options.lookbackHours * HOUR),
          new Date(now.getTime() - options.finishWindowEndMinutes * MINUTE),
        ],
      },
    },
    order: [['matchDate', 'ASC']],
  });

/** Newly settled provider fixtures whose delayed confirmation is now due. */
export const findResultVerificationCandidates = async (
  source: string,
  now: Date,
  options: ResultVerificationOptions
): Promise<Fixture[]> =>
  Fixture.findAll({
    where: {
      syncSource: source,
      status: FixtureStatus.FINISHED,
      resultVerifiedAt: { [Op.is]: null },
      lastSyncedAt: {
        [Op.between]: [
          new Date(now.getTime() - options.lookbackHours * HOUR),
          new Date(now.getTime() - options.delaySeconds * SECOND),
        ],
      },
    },
    order: [['matchDate', 'ASC']],
  });

/**
 * Marks kicked-off fixtures live using nothing but the clock. This is why the
 * provider is never asked about a match in progress: the status the UI needs
 * during play is free, and only the final result has to come from the API.
 */
export const promoteKickedOffFixtures = async (
  report: SyncReport,
  options: { dryRun: boolean },
  now: Date
): Promise<void> => {
  const kickedOff = await Fixture.findAll({
    where: {
      status: FixtureStatus.UPCOMING,
      matchDate: { [Op.lte]: now },
    },
    order: [['matchDate', 'ASC']],
  });

  for (const fixture of kickedOff) {
    if (options.dryRun) {
      record(report, 'update', fixtureLabel(fixture), 'would mark live');
      continue;
    }

    await fixture.update({ status: FixtureStatus.LIVE });
    record(report, 'update', fixtureLabel(fixture), 'kicked off, marked live');
  }
};

/**
 * Records a final result and scores its predictions. A match still in play is
 * deliberately left alone: in this app a score means the match is over, so
 * writing a running score would both mislead the UI and cost extra requests.
 */
export const applyMatchResult = async (
  fixture: Fixture,
  match: ProviderMatch,
  report: SyncReport,
  options: { dryRun: boolean }
): Promise<void> => {
  const label = matchLabel(match);

  if (isFrozen(fixture)) {
    record(report, 'skip', label, 'already final locally');
    return;
  }

  if (match.status === 'postponed' || match.status === 'cancelled') {
    warn(report, `${label} is ${match.status} at the provider.`);

    // A status-only correction, so a fixture we marked live off the clock does
    // not sit there claiming to be in play. Scores are never involved.
    if (fixture.status !== FixtureStatus.UPCOMING) {
      if (options.dryRun) {
        record(report, 'update', label, 'would move back to upcoming');
        return;
      }
      await fixture.update({
        status: FixtureStatus.UPCOMING,
        lastSyncedAt: new Date(),
      });
      record(report, 'update', label, `${match.status}, moved back to upcoming`);
      return;
    }

    record(report, 'skip', label, `${match.status} at provider`);
    return;
  }

  if (match.status !== 'finished') {
    // Still being played. Nothing to write until the final whistle.
    report.skipped += 1;
    return;
  }

  if (match.homeScore == null || match.awayScore == null) {
    warn(report, `${label} is final at the provider but has no score yet.`);
    report.skipped += 1;
    return;
  }

  const detail =
    `final ${match.homeScore}-${match.awayScore}` +
    (fixture.status === FixtureStatus.FINISHED ? ' (score corrected)' : '');

  if (options.dryRun) {
    const count = await Prediction.count({ where: { fixtureId: fixture.id } });
    record(report, 'update', label, `would record ${detail}`);
    if (count > 0) {
      record(report, 'score', label, `would score ${count} prediction(s)`);
    }
    return;
  }

  await fixture.update({
    status: FixtureStatus.FINISHED,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    lastSyncedAt: new Date(),
    resultVerifiedAt: null,
  });
  record(report, 'update', label, detail);

  report.predictionsScored += await scorePredictions(fixture.id, report, label);

  // These two clubs have just met, so their cached history is a match out of
  // date. Dropping it lets the h2h job refetch before their next meeting.
  await invalidateHeadToHead(fixture.homeTeamId, fixture.awayTeamId);
};

/**
 * Confirms a score after the provider has had time to apply late corrections.
 * Unlike normal result settlement this deliberately may update a finished
 * fixture, then uses the same scoring path to keep every prediction correct.
 */
export const applyVerifiedMatchResult = async (
  fixture: Fixture,
  match: ProviderMatch,
  report: SyncReport,
  options: { dryRun: boolean }
): Promise<void> => {
  const label = matchLabel(match);

  if (match.status !== 'finished') {
    warn(
      report,
      `${label} could not be verified because the provider now reports ${match.rawStatus}.`
    );
    report.skipped += 1;
    return;
  }

  if (match.homeScore == null || match.awayScore == null) {
    warn(report, `${label} could not be verified because its final score is empty.`);
    report.skipped += 1;
    return;
  }

  const previousHome = fixture.homeScore;
  const previousAway = fixture.awayScore;
  const changed =
    previousHome !== match.homeScore || previousAway !== match.awayScore;
  const detail = changed
    ? `provider corrected ${previousHome}-${previousAway} to ${match.homeScore}-${match.awayScore}`
    : `confirmed ${match.homeScore}-${match.awayScore}`;

  if (options.dryRun) {
    record(report, changed ? 'update' : 'skip', label, `would mark verified: ${detail}`);
    return;
  }

  await fixture.update({
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    lastSyncedAt: new Date(),
    resultVerifiedAt: new Date(),
  });

  if (!changed) {
    record(report, 'skip', label, `score verified: ${detail}`);
    return;
  }

  record(report, 'update', label, detail);
  // Warnings are persisted in sync_runs, giving corrections a durable audit
  // entry even before a dedicated per-fixture event log is introduced.
  warn(report, `${label}: ${detail}.`);
  report.predictionsScored += await scorePredictions(fixture.id, report, label);
};

/** Reuses the same scoring path the admin result endpoint uses. */
const scorePredictions = async (
  fixtureId: number,
  report: SyncReport,
  label: string
): Promise<number> => {
  const predictions = await Prediction.findAll({ where: { fixtureId } });
  let scored = 0;

  for (const prediction of predictions) {
    try {
      await prediction.calculateAndUpdatePoints();
      scored += 1;
    } catch (error) {
      warn(
        report,
        `Could not score prediction #${prediction.id} for ${label}: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  if (scored > 0) record(report, 'score', label, `scored ${scored} prediction(s)`);
  return scored;
};

/**
 * One request covers every candidate, however many matches kicked off at the
 * same time, because the provider returns a competition's matches by date.
 */
const applyToCandidates = async (
  provider: FootballProvider,
  competition: string,
  candidates: Fixture[],
  report: SyncReport,
  options: ResultSyncOptions
): Promise<void> => {
  const kickoffs = candidates.map((fixture) => fixture.matchDate.getTime());
  const matches = await provider.listMatches({
    competition,
    season: options.season,
    dateFrom: utcDay(new Date(Math.min(...kickoffs))),
    // The provider treats dateTo as exclusive, so reach one day past the last.
    dateTo: utcDay(new Date(Math.max(...kickoffs)), 1),
  });
  report.apiRequests = provider.requestCount;

  const byExternalId = new Map(
    matches.map((match) => [match.externalId, match])
  );

  for (const fixture of candidates) {
    const match = fixture.externalId
      ? byExternalId.get(fixture.externalId)
      : undefined;

    if (!match) {
      warn(
        report,
        `Fixture #${fixture.id} (provider id ${fixture.externalId}) was not in ` +
          'the provider response.'
      );
      report.skipped += 1;
      continue;
    }

    await applyMatchResult(fixture, match, report, options);
  }
};

const verifyCandidates = async (
  provider: FootballProvider,
  competition: string,
  candidates: Fixture[],
  report: SyncReport,
  options: ResultVerificationOptions
): Promise<void> => {
  const kickoffs = candidates.map((fixture) => fixture.matchDate.getTime());
  const matches = await provider.listMatches({
    competition,
    season: options.season,
    dateFrom: utcDay(new Date(Math.min(...kickoffs))),
    dateTo: utcDay(new Date(Math.max(...kickoffs)), 1),
  });
  report.apiRequests = provider.requestCount;

  const byExternalId = new Map(
    matches.map((match) => [match.externalId, match])
  );

  for (const fixture of candidates) {
    const match = fixture.externalId
      ? byExternalId.get(fixture.externalId)
      : undefined;

    if (!match) {
      warn(
        report,
        `Fixture #${fixture.id} (provider id ${fixture.externalId}) was not available for result verification.`
      );
      report.skipped += 1;
      continue;
    }

    await applyVerifiedMatchResult(fixture, match, report, options);
  }
};

/**
 * Marks kicked-off fixtures live for free, then looks for final results among
 * the matches old enough to have ended. A tick with nothing to settle makes no
 * API call at all.
 */
export const syncResults = async (
  provider: FootballProvider,
  competition: string,
  report: SyncReport,
  options: ResultSyncOptions,
  now = new Date()
): Promise<void> => {
  await promoteKickedOffFixtures(report, options, now);

  const candidates = await findFinishCandidates(provider.name, now, options);
  if (candidates.length === 0) return;

  await applyToCandidates(provider, competition, candidates, report, options);
};

/** Catches matches that never settled, for instance while the app was down. */
export const syncReconcile = async (
  provider: FootballProvider,
  competition: string,
  report: SyncReport,
  options: ReconcileOptions,
  now = new Date()
): Promise<void> => {
  const candidates = await findStaleCandidates(provider.name, now, options);
  if (candidates.length === 0) return;

  await applyToCandidates(provider, competition, candidates, report, options);
};

/** Durable delayed score confirmation, normally checked once per minute. */
export const syncResultVerification = async (
  provider: FootballProvider,
  competition: string,
  report: SyncReport,
  options: ResultVerificationOptions,
  now = new Date()
): Promise<void> => {
  const candidates = await findResultVerificationCandidates(
    provider.name,
    now,
    options
  );
  if (candidates.length === 0) return;

  await verifyCandidates(provider, competition, candidates, report, options);
};
