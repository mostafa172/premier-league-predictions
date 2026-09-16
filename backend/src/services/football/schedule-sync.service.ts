import { Op } from 'sequelize';
import { Fixture, FixtureStatus } from '../../models/Fixture';
import {
  FootballProvider,
  ProviderMatch,
  ProviderMatchStatus,
} from '../../integrations/football';
import { SyncReport, record, warn } from './sync-report';
import { TeamResolver } from './team-mapping.service';

const MIN_GAMEWEEK = 1;
const MAX_GAMEWEEK = 38;

export interface ScheduleSyncOptions {
  dryRun: boolean;
  /** Gameweeks past the current one that may be written. */
  horizon: number;
  season?: string;
  /**
   * Create matches the provider has already played. Off by default: the sync
   * exists to keep upcoming gameweeks accurate, not to import history, and a
   * backfilled gameweek would show up as missed predictions for everyone.
   */
  backfillFinished?: boolean;
}

const PROVIDER_TO_FIXTURE_STATUS: Record<
  ProviderMatchStatus,
  FixtureStatus | null
> = {
  upcoming: FixtureStatus.UPCOMING,
  live: FixtureStatus.LIVE,
  finished: FixtureStatus.FINISHED,
  // We have no column for these, so they stay upcoming and raise a warning.
  postponed: null,
  cancelled: null,
};

export const matchLabel = (match: ProviderMatch): string =>
  `GW${match.matchday ?? '?'} ${match.homeTeam.tla || match.homeTeam.name}` +
  ` vs ${match.awayTeam.tla || match.awayTeam.name}`;

/**
 * A fixture is frozen once it has been played: rewriting it would change
 * historical scores and every prediction scored against them.
 */
export const isFrozen = (fixture: Fixture): boolean =>
  fixture.status === FixtureStatus.FINISHED &&
  fixture.homeScore != null &&
  fixture.awayScore != null;

/** Formats a kickoff for change logs without dragging in a date library. */
const fmt = (date: Date): string => date.toISOString().replace('.000Z', 'Z');

export const syncSchedule = async (
  provider: FootballProvider,
  competition: string,
  report: SyncReport,
  options: ScheduleSyncOptions
): Promise<void> => {
  const meta = await provider.getCompetition(competition, options.season);

  // The provider's current matchday anchors the window. Falling back to the
  // furthest gameweek we already hold keeps cup competitions usable.
  const anchor = meta.currentMatchday ?? (await currentLocalGameweek());
  const lastGameweek = Math.min(anchor + options.horizon, MAX_GAMEWEEK);

  const matches = await provider.listMatches({
    competition,
    season: options.season,
  });
  report.apiRequests = provider.requestCount;

  const inWindow = matches.filter(
    (match) =>
      match.matchday != null &&
      match.matchday >= Math.max(anchor, MIN_GAMEWEEK) &&
      match.matchday <= lastGameweek
  );

  const skippedCup = matches.filter((match) => match.matchday == null).length;
  if (skippedCup > 0) {
    warn(
      report,
      `${skippedCup} match(es) have no matchday and cannot map to a gameweek.`
    );
  }

  if (inWindow.length === 0) {
    warn(
      report,
      `No matches between gameweek ${anchor} and ${lastGameweek} for ${competition}.`
    );
    return;
  }

  const resolver = await TeamResolver.load();

  for (const match of inWindow) {
    await syncMatch(match, provider.name, resolver, report, options, anchor);
  }
};

const currentLocalGameweek = async (): Promise<number> => {
  const unfinished = await Fixture.findOne({
    where: { status: { [Op.ne]: FixtureStatus.FINISHED } },
    order: [['gameweek', 'ASC']],
  });
  if (unfinished) return unfinished.gameweek;

  const last = await Fixture.findOne({ order: [['gameweek', 'DESC']] });
  return last ? Math.min(last.gameweek + 1, MAX_GAMEWEEK) : MIN_GAMEWEEK;
};

const syncMatch = async (
  match: ProviderMatch,
  source: string,
  resolver: TeamResolver,
  report: SyncReport,
  options: ScheduleSyncOptions,
  anchor: number
): Promise<void> => {
  const label = matchLabel(match);
  const gameweek = match.matchday as number;

  if (match.status === 'cancelled') {
    warn(report, `${label} is cancelled at the provider; left for you to handle.`);
    record(report, 'skip', label, 'cancelled at provider');
    return;
  }

  const homeTeam = await resolver.resolve(match.homeTeam, source, report, {
    dryRun: options.dryRun,
    createMissing: true,
  });
  const awayTeam = await resolver.resolve(match.awayTeam, source, report, {
    dryRun: options.dryRun,
    createMissing: true,
  });

  if (!homeTeam || !awayTeam) {
    record(
      report,
      'skip',
      label,
      'one of these clubs has no team row and could not be created'
    );
    return;
  }

  const existing = await findLocalFixture(match, source, homeTeam.id, awayTeam.id);

  if (!existing) {
    await createFixture(match, source, homeTeam.id, awayTeam.id, report, options);
    return;
  }

  if (isFrozen(existing)) {
    record(
      report,
      'skip',
      label,
      'already finished locally, left untouched to protect its scores'
    );
    return;
  }

  if (existing.gameweek < anchor) {
    record(
      report,
      'skip',
      label,
      `local gameweek ${existing.gameweek} is behind the window`
    );
    return;
  }

  await updateFixture(match, source, existing, report, options);
};

/**
 * Identity is the provider match id. When we have not seen a match before we
 * look for a manually entered row for the same two clubs and adopt it, so a
 * fixture you typed in by hand never gets a synced duplicate.
 */
const findLocalFixture = async (
  match: ProviderMatch,
  source: string,
  homeTeamId: number,
  awayTeamId: number
): Promise<Fixture | null> => {
  const owned = await Fixture.findOne({
    where: { syncSource: source, externalId: match.externalId },
  });
  if (owned) return owned;

  const candidates = await Fixture.findAll({
    where: { homeTeamId, awayTeamId, externalId: null as any },
    order: [['gameweek', 'ASC']],
  });
  if (candidates.length === 0) return null;

  // Prefer the row already filed under the provider's gameweek.
  return (
    candidates.find((row) => row.gameweek === match.matchday) || candidates[0]
  );
};

const createFixture = async (
  match: ProviderMatch,
  source: string,
  homeTeamId: number,
  awayTeamId: number,
  report: SyncReport,
  options: ScheduleSyncOptions
): Promise<void> => {
  const label = matchLabel(match);
  const status =
    PROVIDER_TO_FIXTURE_STATUS[match.status] ?? FixtureStatus.UPCOMING;

  if (match.status === 'finished' && !options.backfillFinished) {
    record(
      report,
      'skip',
      label,
      'already played and not in our database; use --backfill to import it'
    );
    return;
  }

  if (match.status === 'postponed') {
    warn(report, `${label} is postponed at the provider; created as upcoming.`);
  }

  if (options.dryRun) {
    record(report, 'create', label, `would create, kickoff ${fmt(match.kickoff)}`);
    return;
  }

  // A brand new row has no history to protect, so we take the provider's
  // status and score verbatim. Later updates are far more conservative.
  await Fixture.create({
    homeTeamId,
    awayTeamId,
    matchDate: match.kickoff,
    deadline: match.kickoff,
    gameweek: match.matchday as number,
    status,
    homeScore: status === FixtureStatus.UPCOMING ? undefined : match.homeScore ?? undefined,
    awayScore: status === FixtureStatus.UPCOMING ? undefined : match.awayScore ?? undefined,
    externalId: match.externalId,
    syncSource: source,
    lastSyncedAt: new Date(),
  });

  record(report, 'create', label, `created, kickoff ${fmt(match.kickoff)}`);
};

/**
 * Only scheduling data is updated here. Status and scores belong to the live
 * and reconcile jobs, which have their own guards.
 */
const updateFixture = async (
  match: ProviderMatch,
  source: string,
  fixture: Fixture,
  report: SyncReport,
  options: ScheduleSyncOptions
): Promise<void> => {
  const label = matchLabel(match);
  const adopting = fixture.externalId == null;
  const changes: string[] = [];
  const patch: Record<string, unknown> = {};

  if (fixture.matchDate.getTime() !== match.kickoff.getTime()) {
    changes.push(`kickoff ${fmt(fixture.matchDate)} -> ${fmt(match.kickoff)}`);
    // The deadline follows the kickoff by design.
    patch.matchDate = match.kickoff;
    patch.deadline = match.kickoff;
  }

  if (fixture.gameweek !== match.matchday) {
    changes.push(`gameweek ${fixture.gameweek} -> ${match.matchday}`);
    patch.gameweek = match.matchday;
  }

  if (match.status === 'postponed') {
    warn(report, `${label} is postponed at the provider; date left as is.`);
  }

  if (adopting) {
    patch.externalId = match.externalId;
    patch.syncSource = source;
  }

  if (!adopting && changes.length === 0) {
    report.skipped += 1;
    return;
  }

  if (options.dryRun) {
    record(
      report,
      adopting ? 'adopt' : 'update',
      label,
      adopting
        ? `would adopt fixture #${fixture.id}` +
            (changes.length ? ` and apply ${changes.join(', ')}` : '')
        : `would apply ${changes.join(', ')}`
    );
    return;
  }

  patch.lastSyncedAt = new Date();
  await fixture.update(patch);

  record(
    report,
    adopting ? 'adopt' : 'update',
    label,
    adopting
      ? `adopted fixture #${fixture.id}` +
          (changes.length ? `, ${changes.join(', ')}` : '')
      : changes.join(', ')
  );
};
