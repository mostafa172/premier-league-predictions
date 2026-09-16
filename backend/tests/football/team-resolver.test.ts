import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  store: { rows: [] as any[], created: [] as any[], built: [] as any[] },
}));

vi.mock('../../src/models/Team', () => {
  class Team {
    static async findAll() {
      return mocks.store.rows;
    }
    static async create(values: any) {
      const row = { ...values, id: 900 + mocks.store.created.length, update: vi.fn() };
      mocks.store.created.push(row);
      return row;
    }
    static build(values: any) {
      const row = { ...values, id: undefined };
      mocks.store.built.push(row);
      return row;
    }
  }
  return { Team };
});

import { TeamResolver } from '../../src/services/football/team-mapping.service';
import { createReport } from '../../src/services/football/sync-report';

const localTeam = (row: Record<string, unknown>) => ({
  id: 1,
  externalId: null,
  externalSource: null,
  logoUrl: '/assets/logos/local.png',
  update: vi.fn(async function (this: any, patch: Record<string, unknown>) {
    Object.assign(this, patch);
  }),
  ...row,
});

const report = () => createReport('teams' as never, 'football-data', 'PL', false);

beforeEach(() => {
  mocks.store.rows = [];
  mocks.store.created = [];
  mocks.store.built = [];
});

describe('resolving provider clubs to our teams', () => {
  it('links a club we already have by its code', async () => {
    const arsenal = localTeam({ id: 3, name: 'Arsenal', abbreviation: 'ARS' });
    mocks.store.rows = [arsenal];

    const resolver = await TeamResolver.load();
    const resolved = await resolver.resolve(
      { externalId: 57, name: 'Arsenal FC', tla: 'ARS' },
      'football-data',
      report(),
      { dryRun: false, createMissing: true }
    );

    expect(resolved).toBe(arsenal);
    expect(arsenal.update).toHaveBeenCalledWith({
      externalId: 57,
      externalSource: 'football-data',
    });
    expect(mocks.store.created).toHaveLength(0);
  });

  it('links a club whose code we spell differently', async () => {
    // Ours is NFO, the provider says NOT.
    const forest = localTeam({ id: 4, name: 'Nottingham Forest', abbreviation: 'NFO' });
    mocks.store.rows = [forest];

    const resolver = await TeamResolver.load();
    const resolved = await resolver.resolve(
      { externalId: 351, name: 'Nottingham Forest FC', tla: 'NOT' },
      'football-data',
      report(),
      { dryRun: false, createMissing: true }
    );

    expect(resolved).toBe(forest);
    expect(forest.abbreviation).toBe('NFO');
  });

  it('keeps our name, code and local logo when linking', async () => {
    const bournemouth = localTeam({
      id: 5,
      name: 'AFC Bournemouth',
      abbreviation: 'BOU',
      logoUrl: '/assets/logos/bou.png',
    });
    mocks.store.rows = [bournemouth];

    const resolver = await TeamResolver.load();
    await resolver.resolve(
      {
        externalId: 1044,
        name: 'AFC Bournemouth',
        tla: 'BOU',
        crest: 'https://crests.football-data.org/1044.png',
      },
      'football-data',
      report(),
      { dryRun: false, createMissing: true }
    );

    expect(bournemouth.logoUrl).toBe('/assets/logos/bou.png');
    expect(bournemouth.name).toBe('AFC Bournemouth');
  });

  it('creates a promoted club we have never seen', async () => {
    const resolver = await TeamResolver.load();
    const result = await resolver.resolve(
      {
        externalId: 349,
        name: 'Ipswich Town FC',
        tla: 'IPS',
        crest: 'https://crests.football-data.org/349.png',
      },
      'football-data',
      report(),
      { dryRun: false, createMissing: true }
    );

    expect(result).not.toBeNull();
    expect(mocks.store.created[0]).toMatchObject({
      name: 'Ipswich Town',
      abbreviation: 'IPS',
      externalId: 349,
    });
  });

  it('is idempotent once a club is linked', async () => {
    mocks.store.rows = [
      localTeam({ id: 6, name: 'Chelsea', abbreviation: 'CHE', externalId: 61 }),
    ];

    const resolver = await TeamResolver.load();
    const result = report();
    await resolver.resolve(
      { externalId: 61, name: 'Chelsea FC', tla: 'CHE' },
      'football-data',
      result,
      { dryRun: false, createMissing: true }
    );

    expect(result.changes).toHaveLength(0);
    expect(mocks.store.created).toHaveLength(0);
  });

  it('refuses to fold two clubs that share a code into one row', async () => {
    // Barcelona and Bayern are both FCB at football-data.
    mocks.store.rows = [
      localTeam({
        id: 7,
        name: 'FC Barcelona',
        abbreviation: 'FCB',
        externalId: 81,
      }),
    ];

    const resolver = await TeamResolver.load();
    const result = report();
    const resolved = await resolver.resolve(
      { externalId: 5, name: 'FC Bayern München', tla: 'FCB' },
      'football-data',
      result,
      { dryRun: false, createMissing: true }
    );

    expect(resolved).toBeNull();
    expect(mocks.store.created).toHaveLength(0);
    expect(result.warnings.join(' ')).toContain('already belongs to a different club');
  });

  it('reports a club it cannot create when told not to', async () => {
    const resolver = await TeamResolver.load();
    const result = report();
    const resolved = await resolver.resolve(
      { externalId: 1076, name: 'Coventry City FC', tla: 'COV' },
      'football-data',
      result,
      { dryRun: false, createMissing: false }
    );

    expect(resolved).toBeNull();
    expect(result.warnings.join(' ')).toContain('No local team for COV');
  });

  it('plans a club on a dry run without writing it', async () => {
    const resolver = await TeamResolver.load();
    const result = report();
    const resolved = await resolver.resolve(
      { externalId: 322, name: 'Hull City AFC', tla: 'HUL' },
      'football-data',
      result,
      { dryRun: true, createMissing: true }
    );

    expect(mocks.store.created).toHaveLength(0);
    expect(mocks.store.built[0]).toMatchObject({ name: 'Hull City', abbreviation: 'HUL' });
    // Returned so the rest of the dry run can preview its fixtures.
    expect(resolved).not.toBeNull();
    expect(result.changes[0].detail).toContain('would create');
  });
});
