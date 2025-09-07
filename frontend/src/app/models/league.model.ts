/* filepath: frontend/src/app/models/league.model.ts */

export interface League {
  id: number;
  name: string;
  description?: string;
  joinCode: string;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  memberCount: number;
  creatorUsername: string;
  joinedAt?: Date;
  isCreator?: boolean;
  creator?: {
    id: number;
    username: string;
  };
}

export interface LeagueMember {
  id: number;
  username: string;
  joinedAt: Date;
  totalPoints: number;
  isCreator: boolean;
}

export interface LeagueDetails {
  league: League;
  members: LeagueMember[];
}

export interface CreateLeagueRequest {
  name: string;
  description?: string;
}

export interface JoinLeagueRequest {
  joinCode: string;
}

export interface LeagueResponse {
  success: boolean;
  data: League;
  message?: string;
}

export interface LeagueDetailsResponse {
  success: boolean;
  data: LeagueDetails;
  message?: string;
}

export interface LeagueListResponse {
  success: boolean;
  data: League[];
  message?: string;
}

export interface JoinLeagueResponse {
  success: boolean;
  data: {
    leagueId: number;
    leagueName: string;
  };
  message?: string;
}
