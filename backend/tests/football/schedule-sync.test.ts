import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderMatch } from '../../src/integrations/football/provider.types';

const mocks = vi.hoisted(() => ({
  store: { rows: [] as any[], created: [] as any[] },
}));

vi.mock('../../src/models/Fixture', () => {
  const FixtureStatus = {
    UPCOMING: 'upcoming',
    LIVE: 'live',
    FINISHED: 'finished',
  };

  class Fixture {
    static async findOne(query: any) {
      const where = query?.where ?? {};
      if (where.syncSource && where.externalId !== undefined) {
        return (
          mocks.store.rows.find((row) => row.externalId === where.externalId) ??
          null
        );
      }
      return null;
    }

    static async findAll(query: any) {
      const where = query?.where ?? {};
      if ('homeTeamId' in where) {
        return mocks.store.rows.filter(
          (row) =>
            row.homeTeamId === where.homeTeamId &&
            row.awayTeamId === where.awayTeamId &&
            row.externalId == null
        );
      }
      return [];
    }

    static async create(values: any) {
      mocks.store.created.push(values);
      return values;
    }
  }

  return { Fixture, FixtureStatus };
});

vi.mock('../../src/services/football/team-mapping.service', () => ({
  // Team resolution is covered by its own test; here every club resolves to a
  // row whose id mirrors the provider id.
  TeamResolver: {
    load: async () => ({
      resolve: async (team: { externalId: number }) => ({ id: team.externalId }),
    }),
  },
}));

import { syncSchedule } from '../../src/services/football/schedule-sync.service';
import { createReport } from '../../src/services/football/sync-report';

const fixtureRow = (row: Record<string, unknown>) => ({
  id: 1,
  externalId: null,
  syncSource: null,
  status: 'upcoming',
  homeScore: null,
  awayScore: null,
  gameweek: 5,
  matchDate: new Date('2026-09-18T19:00:00Z'),
  updates: [] as Record<string, unknown>[],
  async update(patch: Record<string, unknown>) {
    (this as any).updates.push(patch);
    Object.assign(this, patch);
    return this;
  },
  ...row,
});

const match = (overrides: Partial<ProviderMatch> = {}): ProviderMatch => ({
  externalId: 900001,
  competitionCode: 'PL',
  matchday: 5,
  kickoff: new Date('2026-09-18T19:00:00Z'),
  status: 'upcoming',
  rawStatus: 'TIMED',
  homeTeam: { externalId: 402, name: 'Brentford FC', tla: 'BRE' },
  awayTeam: { externalId: 61, name: 'Chelsea FC', tla: 'CHE' },
  homeScore: null,
  awayScore: null,
  ...overrides,
});

const provider = (matches: ProviderMatch[], currentMatchday: number | null = 4) => ({
  name: 'football-data',
  requestCount: 2,
  getCompetition: async () => ({
    code: 'PL',
    name: 'Premier League',
    currentMatchday,
  }),
  listMatches: async () => matches,
});

const run = async (
  matches: ProviderMatch[],
  options: { dryRun?: boolean; horizon?: number; backfillFinished?: boolean } = {},
  currentMatchday: number | null = 4
) => {
  const report = createReport('schedule' as never, 'football-data', 'PL', options.dryRun ?? false);
  await syncSchedule(provider(matches, currentMatchday) as never, 'PL', report, {
    dryRun: options.dryRun ?? false,
    horizon: options.horizon ?? 3,
    backfillFinished: options.backfillFinished ?? false,
  });
  return report;
};

beforeEach(() => {
  mocks.store.rows = [];
  mocks.store.created = [];
});

describe('schedule sync window', () => {
  it('writes the current gameweek and the horizon, nothing further out', async () => {
    const report = await run([
      match({ externalId: 1, matchday: 4 }),
      match({ externalId: 2, matchday: 7 }),
      match({ externalId: 3, matchday: 8 }),
    ]);

    expect(mocks.store.created.map((row) => row.gameweek)).toEqual([4, 7]);
    expect(report.created).toBe(2);
  });

  it('leaves gameweeks behind the current one alone', async () => {
    await run([match({ externalId: 1, matchday: 2 })]);
    expect(mocks.store.created).toHaveLength(0);
  });

  it('warns about matches with no matchday instead of guessing one', async () => {
    const report = await run([match({ matchday: null })]);

    expect(mocks.store.created).toHaveLength(0);
    expect(report.warnings.join(' ')).toContain('no matchday');
  });

  it('falls back to our own gameweeks when the provider has no current matchday', async () => {
    const report = await run([match({ matchday: 1 })], {}, null);
    // With an empty fixture table the fallback anchors at gameweek 1.
    expect(report.created).toBe(1);
  });
});

describe('schedule sync data safety', () => {
  it('refuses to rewrite a fixture that already has a final score', async () => {
    mocks.store.rows = [
      fixtureRow({
        id: 11,
        homeTeamId: 402,
        awayTeamId: 61,
        status: 'finished',
        homeScore: 2,
        awayScore: 1,
      }),
    ];

    const report = await run([match({ kickoff: new Date('2026-09-18T20:00:00Z') })]);

    expect(mocks.store.rows[0].updates).toHaveLength(0);
    expect(report.changes[0]).toMatchObject({ action: 'skip' });
    expect(report.changes[0].detail).toContain('protect its scores');
  });

  it('does not import matches that have already been played', async () => {
    const report = await run([
      match({ status: 'finished', homeScore: 3, awayScore: 0 }),
    ]);

    expect(mocks.store.created).toHaveLength(0);
    expect(report.skipped).toBe(1);
  });

  it('imports played matches only when asked to backfill', async () => {
    await run([match({ status: 'finished', homeScore: 3, awayScore: 0 })], {
      backfillFinished: true,
    });

    expect(mocks.store.created[0]).toMatchObject({
      status: 'finished',
      homeScore: 3,
      awayScore: 0,
    });
  });

  it('writes nothing on a dry run', async () => {
    const report = await run([match()], { dryRun: true });

    expect(mocks.store.created).toHaveLength(0);
    expect(report.created).toBe(1);
    expect(report.changes[0].detail).toContain('would create');
  });

  it('never creates a fixture for a cancelled match', async () => {
    const report = await run([match({ status: 'cancelled' })]);

    expect(mocks.store.created).toHaveLength(0);
    expect(report.warnings.join(' ')).toContain('cancelled');
  });
});

describe('schedule sync updates', () => {
  it('adopts a fixture entered by hand instead of duplicating it', async () => {
    mocks.store.rows = [
      fixtureRow({ id: 42, homeTeamId: 402, awayTeamId: 61, gameweek: 5 }),
    ];

    const report = await run([match({ externalId: 900001 })]);

    expect(mocks.store.created).toHaveLength(0);
    expect(mocks.store.rows[0].updates[0]).toMatchObject({
      externalId: 900001,
      syncSource: 'football-data',
    });
    expect(report.changes[0].action).toBe('adopt');
  });

  it('moves a rescheduled kickoff and keeps the deadline on it', async () => {
    mocks.store.rows = [
      fixtureRow({
        id: 7,
        externalId: 900001,
        syncSource: 'football-data',
        homeTeamId: 402,
        awayTeamId: 61,
        matchDate: new Date('2026-09-18T19:00:00Z'),
      }),
    ];

    const newKickoff = new Date('2026-09-20T13:00:00Z');
    const report = await run([match({ kickoff: newKickoff })]);

    const patch = mocks.store.rows[0].updates[0];
    expect(patch.matchDate).toEqual(newKickoff);
    expect(patch.deadline).toEqual(newKickoff);
    expect(report.updated).toBe(1);
  });

  it('follows a match that moves to another gameweek', async () => {
    mocks.store.rows = [
      fixtureRow({
        id: 8,
        externalId: 900001,
        syncSource: 'football-data',
        homeTeamId: 402,
        awayTeamId: 61,
        gameweek: 5,
      }),
    ];

    await run([match({ matchday: 6 })]);

    expect(mocks.store.rows[0].updates[0]).toMatchObject({ gameweek: 6 });
  });

  it('touches nothing when the provider agrees with what we hold', async () => {
    mocks.store.rows = [
      fixtureRow({
        id: 9,
        externalId: 900001,
        syncSource: 'football-data',
        homeTeamId: 402,
        awayTeamId: 61,
        gameweek: 5,
        matchDate: new Date('2026-09-18T19:00:00Z'),
      }),
    ];

    const report = await run([match()]);

    expect(mocks.store.rows[0].updates).toHaveLength(0);
    expect(report.updated).toBe(0);
    expect(report.skipped).toBe(1);
  });
});
