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

export interface LeaderboardEntry {
  userId: number;
  username: string;
  totalPoints: number;
  correctPredictions: number;
  totalPredictions: number;
  rank: number;
}