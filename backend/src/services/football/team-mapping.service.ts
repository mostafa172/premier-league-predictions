import { Team } from '../../models/Team';
import { FootballProvider, ProviderTeam } from '../../integrations/football';
import { SyncReport, record, warn } from './sync-report';

/**
 * Providers suffix club names ("Arsenal FC", "Sunderland AFC") and sometimes
 * disagree with us on the three-letter code: our Nottingham Forest is NFO,
 * football-data calls it NOT. Normalizing the name gives a second way to
 * recognize a club we already have, so we never create a duplicate row.
 */
export const normalizeTeamName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(fc|afc|cf|sc|club)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Drops the provider's club suffix so created rows match our naming style. */
export const displayTeamName = (name: string): string =>
  name.replace(/\s+(FC|AFC|CF|SC)$/i, '').trim();

export interface ResolveOptions {
  dryRun: boolean;
  /** Create promoted clubs we have never seen instead of skipping them. */
  createMissing: boolean;
}

/**
 * Loads the team table once and answers "which of our rows is this provider
 * club?", adopting or creating rows as needed. Relegated clubs are never
 * touched, so historical fixtures and their scores stay intact.
 */
export class TeamResolver {
  private readonly byExternalId = new Map<number, Team>();
  private readonly byAbbreviation = new Map<string, Team>();
  private readonly byName = new Map<string, Team>();

  private constructor(teams: Team[]) {
    teams.forEach((team) => this.index(team));
  }

  static async load(): Promise<TeamResolver> {
    return new TeamResolver(await Team.findAll());
  }

  private index(team: Team): void {
    if (team.externalId != null) this.byExternalId.set(team.externalId, team);
    this.byAbbreviation.set(team.abbreviation.toUpperCase(), team);
    this.byName.set(normalizeTeamName(team.name), team);
  }

  private find(providerTeam: ProviderTeam): Team | undefined {
    const linked = this.byExternalId.get(providerTeam.externalId);
    if (linked) return linked;

    const candidate =
      (providerTeam.tla
        ? this.byAbbreviation.get(providerTeam.tla.toUpperCase())
        : undefined) || this.byName.get(normalizeTeamName(providerTeam.name));

    if (!candidate) return undefined;

    // Codes are not unique across competitions: Barcelona and Bayern are both
    // FCB. A row already linked to another provider club is a different club,
    // so let it fall through to creation and report the clash there.
    if (
      candidate.externalId != null &&
      candidate.externalId !== providerTeam.externalId
    ) {
      return undefined;
    }

    return candidate;
  }

  async resolve(
    providerTeam: ProviderTeam,
    source: string,
    report: SyncReport,
    options: ResolveOptions
  ): Promise<Team | null> {
    const existing = this.find(providerTeam);

    if (existing) {
      if (existing.externalId == null) {
        // Adopt the row we already have. Name, abbreviation and logo are left
        // alone on purpose: local logo assets and existing fixtures depend on
        // them, and the provider's naming differs only cosmetically.
        if (!options.dryRun) {
          await existing.update({
            externalId: providerTeam.externalId,
            externalSource: source,
          });
        }
        this.byExternalId.set(providerTeam.externalId, existing);
        record(
          report,
          'adopt',
          existing.abbreviation,
          `linked to provider id ${providerTeam.externalId} (${providerTeam.name})`
        );
      }
      return existing;
    }

    if (!options.createMissing) {
      warn(
        report,
        `No local team for ${providerTeam.tla || providerTeam.name}; ` +
          'run the teams sync first.'
      );
      return null;
    }

    const abbreviation = (providerTeam.tla || '').toUpperCase().slice(0, 5);
    if (!abbreviation) {
      warn(report, `Provider team ${providerTeam.name} has no code to use.`);
      return null;
    }

    if (this.byAbbreviation.has(abbreviation)) {
      warn(
        report,
        `Cannot create ${providerTeam.name}: abbreviation ${abbreviation} ` +
          'already belongs to a different club.'
      );
      return null;
    }

    const name = displayTeamName(providerTeam.name);

    if (options.dryRun) {
      record(report, 'team', abbreviation, `would create "${name}"`);
      // An unsaved instance, indexed so the rest of the dry run behaves as if
      // the club existed. Without it every fixture for a new club would look
      // unresolvable and a clash between two clubs sharing a code would hide.
      const planned = Team.build({
        name,
        abbreviation,
        logoUrl: providerTeam.crest,
        externalId: providerTeam.externalId,
        externalSource: source,
      });
      this.index(planned);
      return planned;
    }

    const created = await Team.create({
      name,
      abbreviation,
      logoUrl: providerTeam.crest,
      externalId: providerTeam.externalId,
      externalSource: source,
    });
    this.index(created);

    record(
      report,
      'team',
      abbreviation,
      `created "${name}" using the provider crest (drop in a local logo when convenient)`
    );

    return created;
  }
}

/**
 * Links every club in the competition to a local row. Runs off the match list
 * so it costs a single request and works for any competition code.
 */
export const syncTeams = async (
  provider: FootballProvider,
  competition: string,
  report: SyncReport,
  options: { dryRun: boolean }
): Promise<void> => {
  const matches = await provider.listMatches({ competition });
  report.apiRequests = provider.requestCount;

  const providerTeams = new Map<number, ProviderTeam>();
  for (const match of matches) {
    providerTeams.set(match.homeTeam.externalId, match.homeTeam);
    providerTeams.set(match.awayTeam.externalId, match.awayTeam);
  }

  if (providerTeams.size === 0) {
    warn(report, `No teams found for competition ${competition}.`);
    return;
  }

  const resolver = await TeamResolver.load();
  for (const providerTeam of providerTeams.values()) {
    await resolver.resolve(providerTeam, provider.name, report, {
      dryRun: options.dryRun,
      createMissing: true,
    });
  }
};
