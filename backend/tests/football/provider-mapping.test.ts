import { describe, expect, it } from 'vitest';
import { mapRawMatch } from '../../src/integrations/football/football-data.provider';

const rawMatch = (overrides: Record<string, unknown> = {}) => ({
  id: 560591,
  utcDate: '2026-09-18T19:00:00Z',
  status: 'TIMED',
  matchday: 5,
  competition: { code: 'PL' },
  homeTeam: { id: 402, name: 'Brentford FC', shortName: 'Brentford', tla: 'BRE' },
  awayTeam: { id: 61, name: 'Chelsea FC', shortName: 'Chelsea', tla: 'CHE' },
  score: {
    fullTime: { home: null, away: null },
    halfTime: { home: null, away: null },
  },
  ...overrides,
});

describe('football-data match mapping', () => {
  it('maps a scheduled match onto our fixture shape', () => {
    const match = mapRawMatch(rawMatch() as never, 'PL');

    expect(match).toMatchObject({
      externalId: 560591,
      competitionCode: 'PL',
      matchday: 5,
      status: 'upcoming',
      rawStatus: 'TIMED',
      homeScore: null,
      awayScore: null,
    });
    expect(match.kickoff.toISOString()).toBe('2026-09-18T19:00:00.000Z');
    expect(match.homeTeam).toMatchObject({ externalId: 402, tla: 'BRE' });
    expect(match.awayTeam).toMatchObject({ externalId: 61, tla: 'CHE' });
  });

  it.each([
    ['SCHEDULED', 'upcoming'],
    ['TIMED', 'upcoming'],
    ['IN_PLAY', 'live'],
    ['PAUSED', 'live'],
    ['FINISHED', 'finished'],
    ['AWARDED', 'finished'],
    ['POSTPONED', 'postponed'],
    ['SUSPENDED', 'postponed'],
    ['CANCELLED', 'cancelled'],
  ])('translates %s to %s', (rawStatus, expected) => {
    const match = mapRawMatch(rawMatch({ status: rawStatus }) as never, 'PL');
    expect(match.status).toBe(expected);
  });

  it('falls back to upcoming for a status we have never seen', () => {
    const match = mapRawMatch(rawMatch({ status: 'WEATHER_DELAY' }) as never, 'PL');
    expect(match.status).toBe('upcoming');
    expect(match.rawStatus).toBe('WEATHER_DELAY');
  });

  it('reads the running score while a match is in play', () => {
    const match = mapRawMatch(
      rawMatch({
        status: 'IN_PLAY',
        score: {
          fullTime: { home: 1, away: 2 },
          halfTime: { home: 0, away: 1 },
        },
      }) as never,
      'PL'
    );

    expect(match).toMatchObject({ status: 'live', homeScore: 1, awayScore: 2 });
  });

  it('uses the half time score when full time has not been published yet', () => {
    const match = mapRawMatch(
      rawMatch({
        status: 'PAUSED',
        score: {
          fullTime: { home: null, away: null },
          halfTime: { home: 2, away: 0 },
        },
      }) as never,
      'PL'
    );

    expect(match).toMatchObject({ status: 'live', homeScore: 2, awayScore: 0 });
  });

  it('keeps a nil-nil final result rather than treating it as missing', () => {
    const match = mapRawMatch(
      rawMatch({
        status: 'FINISHED',
        score: {
          fullTime: { home: 0, away: 0 },
          halfTime: { home: 0, away: 0 },
        },
      }) as never,
      'PL'
    );

    expect(match).toMatchObject({ status: 'finished', homeScore: 0, awayScore: 0 });
  });

  it('reports a null matchday so cup ties can be filtered out', () => {
    const match = mapRawMatch(rawMatch({ matchday: null }) as never, 'PL');
    expect(match.matchday).toBeNull();
  });

  it('falls back to the requested competition when the payload omits it', () => {
    const match = mapRawMatch(rawMatch({ competition: {} }) as never, 'CL');
    expect(match.competitionCode).toBe('CL');
  });
});
