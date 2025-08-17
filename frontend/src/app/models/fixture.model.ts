export interface Fixture {
  id: number;
  homeTeam: string;
  awayTeam: string;
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
  homeTeam: string;
  awayTeam: string;
  matchDate: string;
  deadline: string;
  gameweek: number;
}

export interface UpdateFixtureRequest {
  homeTeam?: string;
  awayTeam?: string;
  matchDate?: string;
  deadline?: string;
  gameweek?: number;
  homeScore?: number;
  awayScore?: number;
  status?: string;
}