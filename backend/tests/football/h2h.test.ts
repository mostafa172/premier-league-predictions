import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderMatch } from '../../src/integrations/football/provider.types';

const mocks = vi.hoisted(() => ({
  store: {
    fixtures: [] as any[],
    cacheRows: [] as any[],
    created: [] as any[],
    teams: [] as any[],
  },
}));

vi.mock('../../src/models/Fixture', () => {
  const FixtureStatus = {
    UPCOMING: 'upcoming',
    LIVE: 'live',
    FINISHED: 'finished',
  };
  class Fixture {
    static async findAll() {
      return mocks.store.fixtures;
    }
  }
  return { Fixture, FixtureStatus };
});

vi.mock('../../src/models/Team', () => ({
  Team: {
    findAll: async () => mocks.store.teams,
  },
}));

vi.mock('../../src/models/HeadToHead', () => ({
  HeadToHead: {
    findAll: async () => mocks.store.cacheRows,
    upsert: async (values: any) => {
      mocks.store.created.push(values);
      return [values, true];
    },
    destroy: async () => 1,
  },
  pairKey: (one: number, two: number) =>
    one < two ? { teamAId: one, teamBId: two } : { teamAId: two, teamBId: one },
}));

import {
  headToHeadForGameweek,
  summarizeMeetings,
  toMeetings,
  warmHeadToHead,
} from '../../src/services/football/h2h.service';
import { createReport } from '../../src/services/football/sync-report';

/* Brentford (id 12) and Chelsea (id 4), the real fixture we verified against. */
const BRE = 12;
const CHE = 4;

const meetings = [
  { date: '2026-01-17', homeTeamId: CHE, awayTeamId: BRE, homeScore: 2, awayScore: 0 },
  { date: '2025-09-13', homeTeamId: BRE, awayTeamId: CHE, homeScore: 2, awayScore: 2 },
  { date: '2025-04-06', homeTeamId: BRE, awayTeamId: CHE, homeScore: 0, awayScore: 0 },
  { date: '2024-12-15', homeTeamId: CHE, awayTeamId: BRE, homeScore: 2, awayScore: 1 },
  { date: '2024-03-02', homeTeamId: BRE, awayTeamId: CHE, homeScore: 2, awayScore: 2 },
];

const report = (dryRun = false) =>
  createReport('h2h' as never, 'football-data', 'PL', dryRun);

beforeEach(() => {
  mocks.store.fixtures = [];
  mocks.store.cacheRows = [];
  mocks.store.created = [];
  mocks.store.teams = [];
});

describe('computing the head to head record', () => {
  it('counts wins from the perspective of the fixture home team', () => {
    // Brentford at home: Chelsea won twice, three draws.
    const summary = summarizeMeetings(99, BRE, CHE, meetings);

    expect(summary).toMatchObject({
      fixtureId: 99,
      homeWins: 0,
      draws: 3,
      awayWins: 2,
    });
  });

  it('flips the record for the reverse fixture without refetching', () => {
    const summary = summarizeMeetings(100, CHE, BRE, meetings);

    expect(summary).toMatchObject({ homeWins: 2, draws: 3, awayWins: 0 });
  });

  it('marks each meeting with an outcome for the dots', () => {
    const summary = summarizeMeetings(99, BRE, CHE, meetings);

    expect(summary.meetings.map((meeting) => meeting.outcome)).toEqual([
      'away',
      'draw',
      'draw',
      'away',
      'draw',
    ]);
  });

  it('keeps meetings newest first', () => {
    const summary = summarizeMeetings(99, BRE, CHE, meetings);

    expect(summary.meetings[0].date).toBe('2026-01-17');
  });
});

describe('mapping provider meetings', () => {
  const providerMatch = (
    overrides: Partial<ProviderMatch> = {}
  ): ProviderMatch => ({
    externalId: 1,
    competitionCode: 'PL',
    matchday: 20,
    kickoff: new Date('2026-01-17T15:00:00Z'),
    status: 'finished',
    rawStatus: 'FINISHED',
    homeTeam: { externalId: 61, name: 'Chelsea FC', tla: 'CHE' },
    awayTeam: { externalId: 402, name: 'Brentford FC', tla: 'BRE' },
    homeScore: 2,
    awayScore: 0,
    ...overrides,
  });

  const teams = new Map([
    [61, CHE],
    [402, BRE],
  ]);

  it('translates provider ids into our own team ids', () => {
    const result = toMeetings([providerMatch()], teams);

    expect(result).toEqual([
      {
        date: '2026-01-17',
        homeTeamId: CHE,
        awayTeamId: BRE,
        homeScore: 2,
        awayScore: 0,
      },
    ]);
  });

  it('drops meetings that were never played', () => {
    const result = toMeetings(
      [
        providerMatch({ status: 'upcoming', homeScore: null, awayScore: null }),
        providerMatch({ status: 'postponed' }),
      ],
      teams
    );

    expect(result).toHaveLength(0);
  });

  it('drops meetings involving a club we do not have', () => {
    const result = toMeetings(
      [providerMatch({ awayTeam: { externalId: 9999, name: 'Unknown FC' } })],
      teams
    );

    expect(result).toHaveLength(0);
  });

  it('sorts a jumbled response newest first', () => {
    const result = toMeetings(
      [
        providerMatch({ kickoff: new Date('2024-03-02T15:00:00Z') }),
        providerMatch({ kickoff: new Date('2026-01-17T15:00:00Z') }),
        providerMatch({ kickoff: new Date('2025-09-13T15:00:00Z') }),
      ],
      teams
    );

    expect(result.map((meeting) => meeting.date)).toEqual([
      '2026-01-17',
      '2025-09-13',
      '2024-03-02',
    ]);
  });
});

describe('warming the cache', () => {
  const upcoming = (row: Record<string, unknown> = {}) => ({
    id: 1,
    externalId: 560591,
    homeTeamId: BRE,
    awayTeamId: CHE,
    matchDate: new Date('2026-09-18T19:00:00Z'),
    ...row,
  });

  const provider = (calls: number[] = []) => ({
    name: 'football-data',
    requestCount: calls.length,
    listHeadToHead: vi.fn(async (externalId: number) => {
      calls.push(externalId);
      return [];
    }),
  });

  const options = { dryRun: false, limit: 5, maxRequests: 15 };

  it('fetches one pairing once, not once per fixture', async () => {
    // Both legs of the same matchup are open at the same time.
    mocks.store.fixtures = [
      upcoming({ id: 1, externalId: 1, homeTeamId: BRE, awayTeamId: CHE }),
      upcoming({ id: 2, externalId: 2, homeTeamId: CHE, awayTeamId: BRE }),
    ];
    const fake = provider();

    await warmHeadToHead(fake as never, report(), options);

    expect(fake.listHeadToHead).toHaveBeenCalledTimes(1);
    expect(mocks.store.created).toHaveLength(1);
    expect(mocks.store.created[0]).toMatchObject({ teamAId: CHE, teamBId: BRE });
  });

  it('asks for a wide lookback and keeps only the newest five meetings', async () => {
    // The provider's limit is a lookback, not a count, so asking for 5 can
    // return fewer meetings than exist.
    mocks.store.fixtures = [upcoming()];
    mocks.store.teams = [
      { id: CHE, externalId: 61, abbreviation: 'CHE' },
      { id: BRE, externalId: 402, abbreviation: 'BRE' },
    ];

    const seven = Array.from({ length: 7 }, (_, index) => ({
      externalId: index,
      competitionCode: 'PL',
      matchday: 1,
      kickoff: new Date(`202${index}-03-02T15:00:00Z`),
      status: 'finished' as const,
      rawStatus: 'FINISHED',
      homeTeam: { externalId: 402, name: 'Brentford FC', tla: 'BRE' },
      awayTeam: { externalId: 61, name: 'Chelsea FC', tla: 'CHE' },
      homeScore: 1,
      awayScore: 0,
    }));

    const fake = {
      name: 'football-data',
      requestCount: 1,
      listHeadToHead: vi.fn(async () => seven),
    };

    await warmHeadToHead(fake as never, report(), options);

    expect(fake.listHeadToHead).toHaveBeenCalledWith(560591, 50);
    expect(mocks.store.created[0].matches).toHaveLength(5);
    // Newest first, so the five kept are the most recent.
    expect(mocks.store.created[0].matches[0].date).toBe('2026-03-02');
  });

  it('skips a pairing that is already cached', async () => {
    mocks.store.fixtures = [upcoming()];
    mocks.store.cacheRows = [{ teamAId: CHE, teamBId: BRE, matches: meetings }];
    const fake = provider();

    await warmHeadToHead(fake as never, report(), options);

    expect(fake.listHeadToHead).not.toHaveBeenCalled();
    expect(mocks.store.created).toHaveLength(0);
  });

  it('stops at the request cap and says so', async () => {
    mocks.store.fixtures = [
      upcoming({ id: 1, externalId: 1, homeTeamId: 1, awayTeamId: 2 }),
      upcoming({ id: 2, externalId: 2, homeTeamId: 3, awayTeamId: 4 }),
      upcoming({ id: 3, externalId: 3, homeTeamId: 5, awayTeamId: 6 }),
    ];
    const fake = provider();

    await warmHeadToHead(fake as never, report(), { ...options, maxRequests: 2 });

    expect(fake.listHeadToHead).toHaveBeenCalledTimes(2);
  });

  it('keeps going when one pairing fails', async () => {
    mocks.store.fixtures = [
      upcoming({ id: 1, externalId: 1, homeTeamId: 1, awayTeamId: 2 }),
      upcoming({ id: 2, externalId: 2, homeTeamId: 3, awayTeamId: 4 }),
    ];
    const fake = {
      name: 'football-data',
      requestCount: 2,
      listHeadToHead: vi
        .fn()
        .mockRejectedValueOnce(new Error('403 forbidden'))
        .mockResolvedValueOnce([]),
    };
    const result = report();

    await warmHeadToHead(fake as never, result, options);

    expect(mocks.store.created).toHaveLength(1);
    expect(result.warnings.join(' ')).toContain('403 forbidden');
  });

  it('writes nothing on a dry run', async () => {
    mocks.store.fixtures = [upcoming()];
    const fake = provider();
    const result = report(true);

    await warmHeadToHead(fake as never, result, { ...options, dryRun: true });

    expect(fake.listHeadToHead).not.toHaveBeenCalled();
    expect(mocks.store.created).toHaveLength(0);
    expect(result.changes[0].detail).toContain('would fetch');
  });
});

describe('reading a gameweek', () => {
  it('returns a summary per fixture with a cached pairing', async () => {
    mocks.store.fixtures = [
      { id: 77, homeTeamId: BRE, awayTeamId: CHE },
      { id: 78, homeTeamId: 30, awayTeamId: 31 },
    ];
    mocks.store.cacheRows = [
      { teamAId: CHE, teamBId: BRE, matches: meetings },
    ];

    const result = await headToHeadForGameweek(5);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ fixtureId: 77, draws: 3, awayWins: 2 });
  });

  it('omits a pairing whose cached history is empty', async () => {
    mocks.store.fixtures = [{ id: 77, homeTeamId: BRE, awayTeamId: CHE }];
    mocks.store.cacheRows = [{ teamAId: CHE, teamBId: BRE, matches: [] }];

    expect(await headToHeadForGameweek(5)).toHaveLength(0);
  });

  it('returns nothing for a gameweek with no open fixtures', async () => {
    expect(await headToHeadForGameweek(9)).toEqual([]);
  });
});
