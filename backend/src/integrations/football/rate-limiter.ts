/**
 * Serializes calls and keeps them under a rolling requests-per-minute budget.
 * The free football-data plan allows 10/minute and answers with 429 beyond
 * that, so we queue rather than fail.
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly requestsPerMinute: number,
    private readonly windowMs = 60_000
  ) {}

  schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = this.chain.then(() => this.waitForSlot()).then(task);
    // Keep the chain alive even when a task rejects.
    this.chain = run.catch(() => undefined);
    return run;
  }

  private async waitForSlot(): Promise<void> {
    if (this.requestsPerMinute <= 0) return;

    for (;;) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter(
        (at) => now - at < this.windowMs
      );

      if (this.timestamps.length < this.requestsPerMinute) {
        this.timestamps.push(now);
        return;
      }

      const oldest = this.timestamps[0];
      const waitMs = this.windowMs - (now - oldest) + 50;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
