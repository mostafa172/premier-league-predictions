/**
 * Provider-agnostic view of the data we need. Adapters translate their own
 * payloads into these shapes so the sync services never see vendor fields.
 */

/** Normalized lifecycle, wider than our own fixture_status on purpose. */
export type ProviderMatchStatus =
  | 'upcoming'
  | 'live'
  | 'finished'
  | 'postponed'
  | 'cancelled';

export interface ProviderTeam {
  externalId: number;
  name: string;
  shortName?: string;
  /** Three-letter code, e.g. ARS. Used to bootstrap team mapping. */
  tla?: string;
  crest?: string;
}

export interface ProviderMatch {
  externalId: number;
  competitionCode: string;
  /** Null for cup ties with no matchday, which we cannot map to a gameweek. */
  matchday: number | null;
  kickoff: Date;
  status: ProviderMatchStatus;
  /** Untranslated provider status, kept for diagnostics and warnings. */
  rawStatus: string;
  homeTeam: ProviderTeam;
  awayTeam: ProviderTeam;
  homeScore: number | null;
  awayScore: number | null;
}

export interface ProviderCompetition {
  code: string;
  name: string;
  currentMatchday: number | null;
  seasonStart?: string;
  seasonEnd?: string;
}

export interface MatchQuery {
  competition: string;
  /** Season start year, e.g. 2025. Omit for the active season. */
  season?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface FootballProvider {
  readonly name: string;
  getCompetition(code: string, season?: string): Promise<ProviderCompetition>;
  listMatches(query: MatchQuery): Promise<ProviderMatch[]>;
  /**
   * Previous meetings between the two clubs in the given match, newest first.
   * Keyed by match rather than by pair because that is how providers expose
   * it; the caller decides how to cache it.
   */
  listHeadToHead(matchExternalId: number, limit: number): Promise<ProviderMatch[]>;
  /** Number of HTTP requests this instance has made, for quota reporting. */
  readonly requestCount: number;
}

export class FootballProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
    /** How long the provider asked us to wait, when it says so. */
    readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'FootballProviderError';
  }
}
