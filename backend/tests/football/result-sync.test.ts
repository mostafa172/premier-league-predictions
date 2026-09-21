import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderMatch } from '../../src/integrations/football/provider.types';

const mocks = vi.hoisted(() => ({
  store: {
    candidates: [] as any[],
    kickedOff: [] as any[],
    verificationCandidates: [] as any[],
    predictions: [] as any[],
    invalidated: [] as any[],
  },
}));

vi.mock('../../src/models/Fixture', () => {
  const FixtureStatus = {
    UPCOMING: 'upcoming',
    LIVE: 'live',
    FINISHED: 'finished',
  };

  class Fixture {
    static async findAll(query: any) {
      if (query?.where?.status === FixtureStatus.UPCOMING) {
        return mocks.store.kickedOff;
      }
      if (query?.where?.status === FixtureStatus.FINISHED) {
        return mocks.store.verificationCandidates;
      }
      return mocks.store.candidates;
    }
    static async findOne() {
      return null;
    }
  }

  return { Fixture, FixtureStatus };
});

vi.mock('../../src/models/Prediction', () => ({
  Prediction: {
    findAll: async () => mocks.store.predictions,
    count: async () => mocks.store.predictions.length,
  },
}));

vi.mock('../../src/models/HeadToHead', () => ({
  HeadToHead: {
    destroy: vi.fn(async (query: any) => {
      mocks.store.invalidated.push(query.where);
      return 1;
    }),
  },
  pairKey: (one: number, two: number) =>
    one < two ? { teamAId: one, teamBId: two } : { teamAId: two, teamBId: one },
}));

import {
  applyMatchResult,
  applyVerifiedMatchResult,
  promoteKickedOffFixtures,
  syncResultVerification,
  syncResults,
} from '../../src/services/football/result-sync.service';
import { createReport } from '../../src/services/football/sync-report';

const fixtureRow = (row: Record<string, unknown> = {}) => ({
  id: 5,
  externalId: 900001,
  syncSource: 'football-data',
  status: 'live',
  homeScore: null,
  awayScore: null,
  gameweek: 5,
  homeTeamId: 12,
  awayTeamId: 4,
  matchDate: new Date('2026-09-18T19:00:00Z'),
  resultVerifiedAt: null,
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
  status: 'finished',
  rawStatus: 'FINISHED',
  homeTeam: { externalId: 402, name: 'Brentford FC', tla: 'BRE' },
  awayTeam: { externalId: 61, name: 'Chelsea FC', tla: 'CHE' },
  homeScore: 2,
  awayScore: 1,
  ...overrides,
});

const report = (dryRun = false) =>
  createReport('results' as never, 'football-data', 'PL', dryRun);

const prediction = () => {
  const row = {
    id: 1,
    scored: false,
    async calculateAndUpdatePoints() {
      row.scored = true;
    },
  };
  return row;
};

const options = {
  dryRun: false,
  finishWindowStartMinutes: 95,
  finishWindowEndMinutes: 240,
};

beforeEach(() => {
  mocks.store.candidates = [];
  mocks.store.kickedOff = [];
  mocks.store.verificationCandidates = [];
  mocks.store.predictions = [];
  mocks.store.invalidated = [];
});

describe('recording a final result', () => {
  it('writes the final score and scores every prediction', async () => {
    const fixture = fixtureRow();
    const predictions = [prediction(), prediction()];
    mocks.store.predictions = predictions;
    const result = report();

    await applyMatchResult(fixture as never, match(), result, { dryRun: false });

    expect(fixture.updates[0]).toMatchObject({
      status: 'finished',
      homeScore: 2,
      awayScore: 1,
    });
    expect(predictions.every((row) => row.scored)).toBe(true);
    expect(result.predictionsScored).toBe(2);
  });

  it('drops the pairing head to head cache at full time', async () => {
    const fixture = fixtureRow();

    await applyMatchResult(fixture as never, match(), report(), {
      dryRun: false,
    });

    // Keyed lowest id first, so both legs of the pairing share one row.
    expect(mocks.store.invalidated).toEqual([{ teamAId: 4, teamBId: 12 }]);
  });

  it('keeps the head to head cache while a match is in progress', async () => {
    const fixture = fixtureRow();

    await applyMatchResult(
      fixture as never,
      match({ status: 'live', rawStatus: 'IN_PLAY' }),
      report(),
      { dryRun: false }
    );

    expect(mocks.store.invalidated).toHaveLength(0);
  });

  it('leaves a match in progress completely alone', async () => {
    const fixture = fixtureRow();
    mocks.store.predictions = [prediction()];
    const result = report();

    await applyMatchResult(
      fixture as never,
      match({ status: 'live', rawStatus: 'IN_PLAY', homeScore: 1, awayScore: 0 }),
      result,
      { dryRun: false }
    );

    // No running score, no status churn, and nothing scored mid-match.
    expect(fixture.updates).toHaveLength(0);
    expect(fixture.homeScore).toBeNull();
    expect(result.predictionsScored).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('ignores a half time score', async () => {
    const fixture = fixtureRow();
    const result = report();

    await applyMatchResult(
      fixture as never,
      match({ status: 'live', rawStatus: 'PAUSED', homeScore: 0, awayScore: 2 }),
      result,
      { dryRun: false }
    );

    expect(fixture.updates).toHaveLength(0);
  });

  it('waits rather than finishing a match with no score', async () => {
    const fixture = fixtureRow();
    const result = report();

    await applyMatchResult(
      fixture as never,
      match({ homeScore: null, awayScore: null }),
      result,
      { dryRun: false }
    );

    expect(fixture.updates).toHaveLength(0);
    expect(fixture.status).toBe('live');
    expect(result.warnings.join(' ')).toContain('no score yet');
  });

  it('leaves a fixture that is already final untouched', async () => {
    const fixture = fixtureRow({ status: 'finished', homeScore: 3, awayScore: 3 });
    const result = report();

    await applyMatchResult(
      fixture as never,
      match({ homeScore: 0, awayScore: 0 }),
      result,
      { dryRun: false }
    );

    expect(fixture.updates).toHaveLength(0);
    expect(result.changes[0].detail).toContain('already final');
  });

  it('writes nothing on a dry run but reports the scoring it would do', async () => {
    const fixture = fixtureRow();
    mocks.store.predictions = [prediction(), prediction(), prediction()];
    const result = report(true);

    await applyMatchResult(fixture as never, match(), result, { dryRun: true });

    expect(fixture.updates).toHaveLength(0);
    expect(result.changes.map((change) => change.action)).toContain('score');
    expect(result.changes.at(-1)?.detail).toContain('3 prediction(s)');
  });

  it('pulls a postponed match back out of live', async () => {
    const fixture = fixtureRow({ status: 'live' });
    const result = report();

    await applyMatchResult(
      fixture as never,
      match({ status: 'postponed', rawStatus: 'POSTPONED' }),
      result,
      { dryRun: false }
    );

    expect(fixture.updates[0]).toMatchObject({ status: 'upcoming' });
    expect(fixture.homeScore).toBeNull();
    expect(result.warnings.join(' ')).toContain('postponed');
  });
});

describe('marking fixtures live from the clock', () => {
  it('promotes kicked-off fixtures without calling the provider', async () => {
    const fixture = fixtureRow({ status: 'upcoming' });
    mocks.store.kickedOff = [fixture];
    const listMatches = vi.fn();
    const result = report();

    await syncResults(
      { name: 'football-data', requestCount: 0, listMatches } as never,
      'PL',
      result,
      options,
      new Date('2026-09-18T19:01:00Z')
    );

    expect(fixture.updates[0]).toMatchObject({ status: 'live' });
    expect(listMatches).not.toHaveBeenCalled();
    expect(result.apiRequests).toBe(0);
  });

  it('never assigns a score when promoting', async () => {
    const fixture = fixtureRow({ status: 'upcoming' });
    mocks.store.kickedOff = [fixture];

    await promoteKickedOffFixtures(report(), { dryRun: false }, new Date());

    expect(fixture.updates[0]).not.toHaveProperty('homeScore');
    expect(fixture.updates[0]).not.toHaveProperty('awayScore');
  });

  it('writes nothing on a dry run', async () => {
    const fixture = fixtureRow({ status: 'upcoming' });
    mocks.store.kickedOff = [fixture];
    const result = report(true);

    await promoteKickedOffFixtures(result, { dryRun: true }, new Date());

    expect(fixture.updates).toHaveLength(0);
    expect(result.changes[0].detail).toContain('would mark live');
  });
});

describe('results poller gating', () => {
  it('makes no api call while every match is still being played', async () => {
    const listMatches = vi.fn();
    const result = report();

    await syncResults(
      { name: 'football-data', requestCount: 0, listMatches } as never,
      'PL',
      result,
      options
    );

    expect(listMatches).not.toHaveBeenCalled();
    expect(result.apiRequests).toBe(0);
  });

  it('asks the provider once for a whole day of candidates', async () => {
    mocks.store.candidates = [
      fixtureRow({ id: 1, externalId: 1 }),
      fixtureRow({ id: 2, externalId: 2, matchDate: new Date('2026-09-18T21:00:00Z') }),
      fixtureRow({ id: 3, externalId: 3 }),
    ];
    const listMatches = vi.fn(async () => []);
    const result = report();

    await syncResults(
      { name: 'football-data', requestCount: 1, listMatches } as never,
      'PL',
      result,
      options
    );

    expect(listMatches).toHaveBeenCalledTimes(1);
    const query = listMatches.mock.calls[0][0] as any;
    expect(query.dateFrom.toISOString()).toBe('2026-09-18T00:00:00.000Z');
    expect(query.dateTo.toISOString()).toBe('2026-09-19T00:00:00.000Z');
  });

  it('warns when a fixture we own is missing from the provider response', async () => {
    mocks.store.candidates = [fixtureRow({ externalId: 123456 })];
    const result = report();

    await syncResults(
      {
        name: 'football-data',
        requestCount: 1,
        listMatches: async () => [match()],
      } as never,
      'PL',
      result,
      options
    );

    expect(result.warnings.join(' ')).toContain('not in');
    expect(result.skipped).toBe(1);
  });
});

describe('delayed final-score verification', () => {
  it('marks an unchanged final score as verified without rescoring', async () => {
    const fixture = fixtureRow({
      status: 'finished',
      homeScore: 2,
      awayScore: 1,
    });
    mocks.store.predictions = [prediction()];
    const result = report();

    await applyVerifiedMatchResult(fixture as never, match(), result, {
      dryRun: false,
    });

    expect(fixture.updates[0]).toMatchObject({ homeScore: 2, awayScore: 1 });
    expect(fixture.resultVerifiedAt).toBeInstanceOf(Date);
    expect(mocks.store.predictions[0].scored).toBe(false);
    expect(result.changes[0].detail).toContain('confirmed 2-1');
  });

  it('corrects a changed score, rescoring predictions and auditing it', async () => {
    const fixture = fixtureRow({
      status: 'finished',
      homeScore: 2,
      awayScore: 0,
    });
    mocks.store.predictions = [prediction(), prediction()];
    const result = report();

    await applyVerifiedMatchResult(fixture as never, match(), result, {
      dryRun: false,
    });

    expect(fixture.updates[0]).toMatchObject({ homeScore: 2, awayScore: 1 });
    expect(mocks.store.predictions.every((row) => row.scored)).toBe(true);
    expect(result.predictionsScored).toBe(2);
    expect(result.warnings.join(' ')).toContain('corrected 2-0 to 2-1');
  });

  it('leaves verification pending when the provider no longer says final', async () => {
    const fixture = fixtureRow({
      status: 'finished',
      homeScore: 2,
      awayScore: 1,
    });
    const result = report();

    await applyVerifiedMatchResult(
      fixture as never,
      match({ status: 'live', rawStatus: 'IN_PLAY' }),
      result,
      { dryRun: false }
    );

    expect(fixture.updates).toHaveLength(0);
    expect(fixture.resultVerifiedAt).toBeNull();
    expect(result.warnings.join(' ')).toContain('could not be verified');
  });

  it('uses one provider request for all due verifications', async () => {
    mocks.store.verificationCandidates = [
      fixtureRow({ status: 'finished', homeScore: 2, awayScore: 1 }),
      fixtureRow({
        id: 6,
        externalId: 900002,
        status: 'finished',
        homeScore: 0,
        awayScore: 0,
      }),
    ];
    const listMatches = vi.fn(async () => [
      match(),
      match({ externalId: 900002, homeScore: 0, awayScore: 0 }),
    ]);

    await syncResultVerification(
      { name: 'football-data', requestCount: 1, listMatches } as never,
      'PL',
      report(),
      { dryRun: false, delaySeconds: 120, lookbackHours: 48 }
    );

    expect(listMatches).toHaveBeenCalledTimes(1);
  });
});
