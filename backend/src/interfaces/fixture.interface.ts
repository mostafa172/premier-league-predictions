/* filepath: backend/src/interfaces/fixture.interface.ts */
import { FixtureStatus } from '../models/Fixture';

export interface FixtureCreationAttributes {
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  deadline: Date;
  gameweek: number;
  status?: FixtureStatus;
  homeScore?: number;
  awayScore?: number;
}

export interface FixtureUpdateAttributes {
  homeTeam?: string;
  awayTeam?: string;
  matchDate?: Date;
  deadline?: Date;
  gameweek?: number;
  status?: FixtureStatus;
  homeScore?: number;
  awayScore?: number;
}