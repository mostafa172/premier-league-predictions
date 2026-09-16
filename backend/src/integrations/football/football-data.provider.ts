import axios, { AxiosInstance, AxiosError } from 'axios';
import { RateLimiter, sleep } from './rate-limiter';
import {
  FootballProvider,
  FootballProviderError,
  MatchQuery,
  ProviderCompetition,
  ProviderMatch,
  ProviderMatchStatus,
  ProviderTeam,
} from './provider.types';

/** Raw shapes from https://docs.football-data.org/general/v4 */
interface RawTeam {
  id: number;
  name: string;
  shortName?: string;
  tla?: string;
  crest?: string;
}

interface RawScoreLine {
  home: number | null;
  away: number | null;
}

interface RawMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  competition?: { code?: string };
  homeTeam: RawTeam;
  awayTeam: RawTeam;
  score?: {
    fullTime?: RawScoreLine;
    halfTime?: RawScoreLine;
  };
}

interface RawCompetition {
  code: string;
  name: string;
  currentSeason?: {
    startDate?: string;
    endDate?: string;
    currentMatchday?: number | null;
  };
}

/**
 * football-data.org uses a finer-grained lifecycle than we do. AWARDED means a
 * result was decided off the pitch, which counts as finished for scoring.
 */
const STATUS_MAP: Record<string, ProviderMatchStatus> = {
  SCHEDULED: 'upcoming',
  TIMED: 'upcoming',
  IN_PLAY: 'live',
  PAUSED: 'live',
  FINISHED: 'finished',
  AWARDED: 'finished',
  POSTPONED: 'postponed',
  SUSPENDED: 'postponed',
  CANCELLED: 'cancelled',
};

const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);

export const mapRawTeam = (raw: RawTeam): ProviderTeam => ({
  externalId: raw.id,
  name: raw.name,
  shortName: raw.shortName,
  tla: raw.tla,
  crest: raw.crest,
});

/** Exported so the mapping can be tested without touching the network. */
export const mapRawMatch = (
  raw: RawMatch,
  fallbackCompetition: string
): ProviderMatch => {
  const status = STATUS_MAP[raw.status] ?? 'upcoming';

  // During play fullTime carries the running score; halfTime is the fallback
  // for the brief window where only the interval result is published.
  const fullTime = raw.score?.fullTime;
  const halfTime = raw.score?.halfTime;
  const line =
    fullTime?.home !== null && fullTime?.home !== undefined
      ? fullTime
      : status === 'live'
      ? halfTime
      : fullTime;

  return {
    externalId: raw.id,
    competitionCode: raw.competition?.code || fallbackCompetition,
    matchday: raw.matchday ?? null,
    kickoff: new Date(raw.utcDate),
    status,
    rawStatus: raw.status,
    homeTeam: mapRawTeam(raw.homeTeam),
    awayTeam: mapRawTeam(raw.awayTeam),
    homeScore: line?.home ?? null,
    awayScore: line?.away ?? null,
  };
};

export interface FootballDataProviderOptions {
  apiKey: string;
  baseUrl?: string;
  requestsPerMinute?: number;
  timeoutMs?: number;
  /** Retries for 429 and 5xx responses. */
  maxRetries?: number;
}

export class FootballDataProvider implements FootballProvider {
  readonly name = 'football-data';

  private readonly http: AxiosInstance;
  private readonly limiter: RateLimiter;
  private readonly maxRetries: number;
  private requests = 0;

  constructor(options: FootballDataProviderOptions) {
    this.http = axios.create({
      baseURL: options.baseUrl || 'https://api.football-data.org/v4',
      timeout: options.timeoutMs ?? 15000,
      headers: { 'X-Auth-Token': options.apiKey },
    });
    this.limiter = new RateLimiter(options.requestsPerMinute ?? 10);
    this.maxRetries = options.maxRetries ?? 2;
  }

  get requestCount(): number {
    return this.requests;
  }

  async getCompetition(
    code: string,
    season?: string
  ): Promise<ProviderCompetition> {
    const raw = await this.get<RawCompetition>(`/competitions/${code}`, {
      season: season || undefined,
    });

    return {
      code: raw.code,
      name: raw.name,
      currentMatchday: raw.currentSeason?.currentMatchday ?? null,
      seasonStart: raw.currentSeason?.startDate,
      seasonEnd: raw.currentSeason?.endDate,
    };
  }

  async listMatches(query: MatchQuery): Promise<ProviderMatch[]> {
    const payload = await this.get<{ matches?: RawMatch[] }>(
      `/competitions/${query.competition}/matches`,
      {
        season: query.season || undefined,
        dateFrom: query.dateFrom ? toIsoDate(query.dateFrom) : undefined,
        dateTo: query.dateTo ? toIsoDate(query.dateTo) : undefined,
      }
    );

    return (payload.matches ?? []).map((match) =>
      mapRawMatch(match, query.competition)
    );
  }

  private async get<T>(
    path: string,
    params: Record<string, string | undefined> = {}
  ): Promise<T> {
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined)
    );

    let attempt = 0;
    for (;;) {
      try {
        return await this.limiter.schedule(async () => {
          this.requests += 1;
          const response = await this.http.get<T>(path, { params: clean });
          return response.data;
        });
      } catch (error) {
        const wrapped = this.toProviderError(error, path);
        if (!wrapped.retryable || attempt >= this.maxRetries) throw wrapped;

        attempt += 1;
        await sleep(attempt * 5000);
      }
    }
  }

  private toProviderError(error: unknown, path: string): FootballProviderError {
    if (!axios.isAxiosError(error)) {
      const message = error instanceof Error ? error.message : String(error);
      return new FootballProviderError(
        `football-data request to ${path} failed: ${message}`
      );
    }

    const axiosError = error as AxiosError<{ message?: string }>;
    const status = axiosError.response?.status;
    const detail =
      axiosError.response?.data?.message || axiosError.message || 'unknown';

    if (status === 403) {
      return new FootballProviderError(
        `football-data denied access to ${path}: ${detail}. ` +
          'This resource usually needs a paid plan.',
        status
      );
    }

    if (status === 404) {
      return new FootballProviderError(
        `football-data has no resource at ${path}: ${detail}`,
        status
      );
    }

    const retryable =
      status === 429 || status === undefined || (status >= 500 && status < 600);

    return new FootballProviderError(
      `football-data request to ${path} failed (${status ?? 'network'}): ${detail}`,
      status,
      retryable
    );
  }
}
