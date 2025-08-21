/* filepath: frontend/src/app/services/prediction.service.ts */
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

interface Prediction {
  id: number;
  fixtureId: number;
  userId: number;
  predictedHomeScore: number; // Changed from homeScore
  predictedAwayScore: number;  // Changed from awayScore
  points?: number;
  isDouble?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface PredictionResponse {
  success: boolean;
  data: Prediction[];
  message?: string;
}

interface LeaderboardResponse {
  success: boolean;
  data: Array<{
    userId: number;
    username: string;
    totalPoints: number;
    totalPredictions: number;
  }>;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PredictionService {
  private readonly API_URL = 'http://localhost:3000/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  // Get predictions for a specific gameweek
  getPredictionsByGameweek(gameweek: number): Observable<PredictionResponse> {
    return this.http.get<PredictionResponse>(
      `${this.API_URL}/predictions/gameweek/${gameweek}`,
      { headers: this.getHeaders() }
    );
  }

  // Get USER'S predictions for a specific gameweek
  getUserPredictionsByGameweek(gameweek: number): Observable<PredictionResponse> {
    return this.http.get<PredictionResponse>(
      `${this.API_URL}/predictions/user/gameweek/${gameweek}`,
      { headers: this.getHeaders() }
    );
  }

  // Get user's predictions
  getUserPredictions(): Observable<PredictionResponse> {
    return this.http.get<PredictionResponse>(
      `${this.API_URL}/predictions/my-predictions`,
      { headers: this.getHeaders() }
    );
  }

  // Submit predictions for multiple fixtures
  submitPredictions(predictions: Array<{fixtureId: number, homeScore: number, awayScore: number}>): Observable<any> {
    return this.http.post<any>(
      `${this.API_URL}/predictions/batch`,
      { predictions },
      { headers: this.getHeaders() }
    );
  }

  // Submit single prediction
  submitPrediction(fixtureId: number, homeScore: number, awayScore: number): Observable<any> {
    return this.http.post<any>(
      `${this.API_URL}/predictions`,
      { fixtureId, homeScore, awayScore },
      { headers: this.getHeaders() }
    );
  }

  // CREATE prediction (alias for submitPrediction)
  createPrediction(prediction: {fixtureId: number, homeScore: number, awayScore: number}): Observable<any> {
    return this.submitPrediction(prediction.fixtureId, prediction.homeScore, prediction.awayScore);
  }

  // Update prediction
  updatePrediction(predictionId: number, homeScore: number, awayScore: number): Observable<any> {
    return this.http.put<any>(
      `${this.API_URL}/predictions/${predictionId}`,
      { homeScore, awayScore },
      { headers: this.getHeaders() }
    );
  }

  // Get leaderboard
  getLeaderboard(): Observable<LeaderboardResponse> {
    return this.http.get<LeaderboardResponse>(
      `${this.API_URL}/predictions/leaderboard`,
      { headers: this.getHeaders() }
    );
  }

  // Delete prediction
  deletePrediction(predictionId: number): Observable<any> {
    return this.http.delete<any>(
      `${this.API_URL}/predictions/${predictionId}`,
      { headers: this.getHeaders() }
    );
  }
}