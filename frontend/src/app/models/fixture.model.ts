/* filepath: frontend/src/app/models/fixture.model.ts */
import { Team } from './team.model';

export interface Fixture {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: Team;
  awayTeam: Team;
  matchDate: Date;
  deadline: Date;
  homeScore?: number;
  awayScore?: number;
  status: 'upcoming' | 'live' | 'finished';
  gameweek: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateFixtureRequest {
  homeTeamId: number;
  awayTeamId: number;
  matchDate: string;
  deadline: string;
  gameweek: number;
}