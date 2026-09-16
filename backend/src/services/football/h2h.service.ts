import { Op } from 'sequelize';
import { Fixture, FixtureStatus } from '../../models/Fixture';
import { H2HMeeting, HeadToHead, pairKey } from '../../models/HeadToHead';
import { Team } from '../../models/Team';
import { FootballProvider, ProviderMatch } from '../../integrations/football';
import { SyncReport, record, warn } from './sync-report';

/** Meetings we store and show. */
export const H2H_LIMIT = 5;

/**
 * The provider's `limit` is a lookback over recent matches rather than a count
 * of meetings to return: asking for 5 returned 3 Tottenham v Villa meetings
 * while asking for 50 returned 13. So we ask wide and take the newest few
 * ourselves.
 */
export const H2H_PROVIDER_LOOKBACK = 50;

export interface H2HSyncOptions {
  dryRun: boolean;
  limit: number;
  /**
   * Requests allowed per run. A cold cache costs one request per pairing, so
   * this spreads the initial fill over a few runs instead of stalling on the
   * provider's per-minute budget.
   */
  maxRequests: number;
}

export type H2HOutcome = 'home' | 'draw' | 'away';

export interface H2HMeetingView extends H2HMeeting {
  /** Relative to the home team of the fixture being viewed. */
  outcome: H2HOutcome;
}

export interface H2HSummary {
  fixtureId: number;
  homeTeamId: number;
  awayTeamId: number;
  /** Counted from the perspective of this fixture's home team. */
  homeWins: number;
  draws: number;
  awayWins: number;
  /** Newest meeting first. */
  meetings: H2HMeetingView[];
}

/**
 * Turns stored meetings into the shape the card renders, resolving every
 * outcome against the home team of the fixture being looked at, so the same
 * cached row reads correctly for both legs of a pairing.
 */
export const summarizeMeetings = (
  fixtureId: number,
  homeTeamId: number,
  awayTeamId: number,
  meetings: H2HMeeting[]
): H2HSummary => {
  const view: H2HMeetingView[] = meetings.map((meeting) => {
    let outcome: H2HOutcome = 'draw';

    if (meeting.homeScore !== meeting.awayScore) {
      const winner =
        meeting.homeScore > meeting.awayScore
          ? meeting.homeTeamId
          : meeting.awayTeamId;
      outcome = winner === homeTeamId ? 'home' : 'away';
    }

    return { ...meeting, outcome };
  });

  return {
    fixtureId,
    homeTeamId,
    awayTeamId,
    homeWins: view.filter((meeting) => meeting.outcome === 'home').length,
    draws: view.filter((meeting) => meeting.outcome === 'draw').length,
    awayWins: view.filter((meeting) => meeting.outcome === 'away').length,
    meetings: view,
  };
};

/** Keeps only played meetings we can express with our own team ids. */
export const toMeetings = (
  matches: ProviderMatch[],
  teamsByExternalId: Map<number, number>
): H2HMeeting[] =>
  matches
    .filter(
      (match) =>
        match.status === 'finished' &&
        match.homeScore != null &&
        match.awayScore != null
    )
    .map((match) => {
      const homeTeamId = teamsByExternalId.get(match.homeTeam.externalId);
      const awayTeamId = teamsByExternalId.get(match.awayTeam.externalId);
      if (homeTeamId === undefined || awayTeamId === undefined) return null;

      return {
        date: match.kickoff.toISOString().slice(0, 10),
        homeTeamId,
        awayTeamId,
        homeScore: match.homeScore as number,
        awayScore: match.awayScore as number,
      };
    })
    .filter((meeting): meeting is H2HMeeting => meeting !== null)
    .sort((left, right) => right.date.localeCompare(left.date));

const loadTeams = async (): Promise<{
  /** provider id -> our team id */
  byExternalId: Map<number, number>;
  /** our team id -> three letter code, for readable change logs */
  codeById: Map<number, string>;
}> => {
  const teams = await Team.findAll();

  return {
    byExternalId: new Map(
      teams
        .filter((team) => team.externalId != null)
        .map((team) => [team.externalId as number, team.id])
    ),
    codeById: new Map(teams.map((team) => [team.id, team.abbreviation])),
  };
};

/**
 * Fills the cache for fixtures still open for predictions. A pairing is only
 * fetched when we have nothing for it, because its history cannot change until
 * the two clubs meet again, and that meeting invalidates the row.
 */
export const warmHeadToHead = async (
  provider: FootballProvider,
  report: SyncReport,
  options: H2HSyncOptions
): Promise<void> => {
  const open = await Fixture.findAll({
    where: {
      syncSource: provider.name,
      status: FixtureStatus.UPCOMING,
      externalId: { [Op.ne]: null as never },
    },
    order: [['matchDate', 'ASC']],
  });

  if (open.length === 0) return;

  const cached = await HeadToHead.findAll();
  const have = new Set(
    cached.map((row) => `${row.teamAId}:${row.teamBId}`)
  );
  const teams = await loadTeams();

  let spent = 0;

  for (const fixture of open) {
    const key = pairKey(fixture.homeTeamId, fixture.awayTeamId);
    const keyString = `${key.teamAId}:${key.teamBId}`;

    if (have.has(keyString)) continue;

    if (spent >= options.maxRequests) {
      warn(
        report,
        `Stopped after ${options.maxRequests} request(s); the remaining ` +
          'pairings will fill in on the next run.'
      );
      break;
    }

    const label =
      `${teams.codeById.get(fixture.homeTeamId) ?? fixture.homeTeamId}` +
      ` v ${teams.codeById.get(fixture.awayTeamId) ?? fixture.awayTeamId}`;

    if (options.dryRun) {
      record(report, 'create', label, 'would fetch and cache the last meetings');
      have.add(keyString);
      continue;
    }

    try {
      const matches = await provider.listHeadToHead(
        fixture.externalId as number,
        H2H_PROVIDER_LOOKBACK
      );
      spent += 1;

      const meetings = toMeetings(matches, teams.byExternalId).slice(
        0,
        options.limit
      );
      // Upsert rather than insert so a refetch, or an unlucky race, refreshes
      // the pairing instead of failing on the unique pair index.
      await HeadToHead.upsert({
        ...key,
        provider: provider.name,
        matches: meetings,
        fetchedAt: new Date(),
      });
      have.add(keyString);

      record(
        report,
        'create',
        label,
        `cached ${meetings.length} previous meeting(s)`
      );
    } catch (error) {
      warn(
        report,
        `Could not load head to head for fixture #${fixture.id}: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  report.apiRequests = provider.requestCount;
};

/**
 * Drops a pairing's cache because the two clubs have just met, which makes the
 * stored history one match out of date.
 */
export const invalidateHeadToHead = async (
  homeTeamId: number,
  awayTeamId: number
): Promise<void> => {
  await HeadToHead.destroy({ where: pairKey(homeTeamId, awayTeamId) });
};

/**
 * Everything the predictions page needs for one gameweek, in a single pass:
 * two queries total, and never a provider call, so a page view cannot be slow
 * or spend quota.
 */
export const headToHeadForGameweek = async (
  gameweek: number
): Promise<H2HSummary[]> => {
  const fixtures = await Fixture.findAll({
    where: { gameweek, status: FixtureStatus.UPCOMING },
  });

  if (fixtures.length === 0) return [];

  const keys = fixtures.map((fixture) =>
    pairKey(fixture.homeTeamId, fixture.awayTeamId)
  );

  const rows = await HeadToHead.findAll({
    where: { [Op.or]: keys },
  });

  const byPair = new Map(
    rows.map((row) => [`${row.teamAId}:${row.teamBId}`, row])
  );

  const summaries: H2HSummary[] = [];

  for (const fixture of fixtures) {
    const key = pairKey(fixture.homeTeamId, fixture.awayTeamId);
    const row = byPair.get(`${key.teamAId}:${key.teamBId}`);
    if (!row || row.matches.length === 0) continue;

    summaries.push(
      summarizeMeetings(
        fixture.id,
        fixture.homeTeamId,
        fixture.awayTeamId,
        row.matches
      )
    );
  }

  return summaries;
};
