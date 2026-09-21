import "./env";

const bool = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
};

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt((value ?? "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const FOOTBALL_CONFIG = {
  /** Master switch for the scheduled jobs. Manual/CLI syncs ignore this. */
  syncEnabled: bool(process.env.FOOTBALL_SYNC_ENABLED, false),

  provider: (process.env.FOOTBALL_API_PROVIDER || "football-data").trim(),
  apiKey: (process.env.FOOTBALL_API_KEY || "").trim(),
  baseUrl: (
    process.env.FOOTBALL_API_BASE_URL || "https://api.football-data.org/v4"
  ).trim(),

  /** Competition synced by the scheduled jobs. The CLI can target any code. */
  competition: (process.env.FOOTBALL_COMPETITION || "PL").trim(),
  /** Starting year of the season, e.g. 2025. Empty means the active season. */
  season: (process.env.FOOTBALL_SEASON || "").trim(),

  /** How many gameweeks past the current one the schedule sync may write. */
  gameweekHorizon: int(process.env.FOOTBALL_SYNC_GAMEWEEK_HORIZON, 3),

  scheduleCron: (process.env.FOOTBALL_SYNC_SCHEDULE_CRON || "0 4 * * 1").trim(),
  reconcileCron: (
    process.env.FOOTBALL_SYNC_RECONCILE_CRON || "20 * * * *"
  ).trim(),
  resultsIntervalSeconds: int(
    process.env.FOOTBALL_SYNC_RESULTS_INTERVAL_SECONDS,
    300
  ),
  resultVerificationIntervalSeconds: int(
    process.env.FOOTBALL_RESULT_VERIFICATION_INTERVAL_SECONDS,
    30
  ),
  resultVerificationDelaySeconds: int(
    process.env.FOOTBALL_RESULT_VERIFICATION_DELAY_SECONDS,
    90
  ),

  /**
   * Results are polled only between these minutes after kickoff. A match in
   * progress is never polled, because we record a score only when it is final,
   * so a 90 minute match costs a handful of requests near the final whistle
   * instead of one every tick from kickoff.
   */
  finishWindowStartMinutes: int(
    process.env.FOOTBALL_FINISH_WINDOW_START_MINUTES,
    95
  ),
  finishWindowEndMinutes: int(
    process.env.FOOTBALL_FINISH_WINDOW_END_MINUTES,
    240
  ),

  /** Reconciliation looks this far back for fixtures that never finished. */
  reconcileLookbackHours: int(process.env.FOOTBALL_RECONCILE_LOOKBACK_HOURS, 48),

  h2hCron: (process.env.FOOTBALL_SYNC_H2H_CRON || "40 5 * * *").trim(),
  /** Pairings fetched per h2h run, so a cold cache spreads over a few runs. */
  h2hMaxRequestsPerRun: int(process.env.FOOTBALL_H2H_MAX_REQUESTS_PER_RUN, 15),

  /**
   * One below the free tier's ten per minute. The provider's accounting and
   * ours disagree at the boundary, and a 429 costs a request of its own.
   */
  requestsPerMinute: int(process.env.FOOTBALL_API_REQUESTS_PER_MINUTE, 9),
  requestTimeoutMs: int(process.env.FOOTBALL_API_TIMEOUT_MS, 15000),
};

export type FootballConfig = typeof FOOTBALL_CONFIG;

export const assertFootballApiConfigured = (): void => {
  if (!FOOTBALL_CONFIG.apiKey) {
    throw new Error(
      "FOOTBALL_API_KEY is required to talk to the football API. " +
        "Get a free token at https://www.football-data.org/client/register"
    );
  }
};
