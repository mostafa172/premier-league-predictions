import {
  FOOTBALL_CONFIG,
  assertFootballApiConfigured,
} from '../../config/football';
import { FootballDataProvider } from './football-data.provider';
import { FootballProvider } from './provider.types';

export * from './provider.types';
export { FootballDataProvider } from './football-data.provider';
export { RateLimiter, sleep } from './rate-limiter';

/**
 * Builds the adapter named by FOOTBALL_API_PROVIDER. Sync services depend on
 * the interface only, so adding a provider never touches them.
 */
export const createFootballProvider = (): FootballProvider => {
  assertFootballApiConfigured();

  switch (FOOTBALL_CONFIG.provider) {
    case 'football-data':
      return new FootballDataProvider({
        apiKey: FOOTBALL_CONFIG.apiKey,
        baseUrl: FOOTBALL_CONFIG.baseUrl,
        requestsPerMinute: FOOTBALL_CONFIG.requestsPerMinute,
        timeoutMs: FOOTBALL_CONFIG.requestTimeoutMs,
      });
    default:
      throw new Error(
        `Unknown FOOTBALL_API_PROVIDER "${FOOTBALL_CONFIG.provider}". ` +
          'Supported providers: football-data'
      );
  }
};
