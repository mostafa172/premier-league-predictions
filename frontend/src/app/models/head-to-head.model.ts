export type H2HOutcome = "home" | "draw" | "away";

/** One previous meeting between the two clubs of a fixture. */
export interface H2HMeeting {
  /** Day precision, which is all the modal shows. */
  date: string;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
  /** Resolved against the home team of the fixture being viewed. */
  outcome: H2HOutcome;
}

export interface HeadToHead {
  fixtureId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  /** Newest meeting first. */
  meetings: H2HMeeting[];
  /**
   * Same meetings oldest first, for the form dots which read left to right.
   * Precomputed so the template does not rebuild an array on every change
   * detection pass.
   */
  dots?: H2HMeeting[];
}
