export interface PredictionCreationAttributes {
    userId: number;
    fixtureId: number;
    predictedHomeScore: number;
    predictedAwayScore: number;
    isDouble?: boolean;
    points?: number;
  }
  
  export interface PredictionUpdateAttributes {
    predictedHomeScore?: number;
    predictedAwayScore?: number;
    isDouble?: boolean;
    points?: number;
  }