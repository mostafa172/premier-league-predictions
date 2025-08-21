export interface Prediction {
  id: number;
  userId: number;
  fixtureId: number;
  homeScore: number;
  awayScore: number;
  points?: number;
  isDouble?: boolean; // Add this field
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PredictionRequest {
  fixtureId: number;
  homeScore: number;
  awayScore: number;
  isDouble?: boolean;
}

interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  totalPoints: number;
  totalPredictions: number;
}
