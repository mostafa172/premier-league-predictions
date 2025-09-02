/* filepath: frontend/src/app/services/prediction.service.ts */
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PredictionService {
  private readonly API_URL = environment.apiUrl;

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

  // Create single prediction with double support
  createPrediction(prediction: {fixtureId: number, homeScore: number, awayScore: number, isDouble?: boolean}): Observable<any> {
    const payload = { 
      fixtureId: prediction.fixtureId, 
      homeScore: prediction.homeScore, 
      awayScore: prediction.awayScore,
      isDouble: Boolean(prediction.isDouble) // Ensure it's a boolean
    };
    
    console.log('Creating prediction with payload:', payload);
    
    return this.http.post<any>(
      `${this.API_URL}/predictions`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  // Update prediction with double support
  updatePrediction(predictionId: number, homeScore: number, awayScore: number, isDouble: boolean = false): Observable<any> {
    const payload = { 
      homeScore, 
      awayScore, 
      isDouble: Boolean(isDouble) // Ensure it's a boolean
    };
    
    console.log('Updating prediction with payload:', payload);
    
    return this.http.put<any>(
      `${this.API_URL}/predictions/${predictionId}`,
      payload,
      { headers: this.getHeaders() }
    );
  }

  // Get predictions for a specific gameweek
  getPredictionsByGameweek(gameweek: number): Observable<any> {
    return this.http.get<any>(
      `${this.API_URL}/predictions/gameweek/${gameweek}`,
      { headers: this.getHeaders() }
    );
  }

  // Get USER'S predictions for a specific gameweek
  getUserPredictionsByGameweek(gameweek: number): Observable<any> {
    return this.http.get<any>(
      `${this.API_URL}/predictions/user/gameweek/${gameweek}`,
      { headers: this.getHeaders() }
    );
  }

  // Get user's total points for a specific gameweek
  getUserGameweekTotal(gameweek: number): Observable<any> {
    return this.http.get<any>(
      `${this.API_URL}/predictions/user/gameweek/${gameweek}/total`,
      { headers: this.getHeaders() }
    );
  }

  // Get user's predictions
  getUserPredictions(): Observable<any> {
    return this.http.get<any>(
      `${this.API_URL}/predictions/my-predictions`,
      { headers: this.getHeaders() }
    );
  }

  // Submit predictions for multiple fixtures
  submitPredictions(predictions: Array<{fixtureId: number, homeScore: number, awayScore: number, isDouble?: boolean}>): Observable<any> {
    const payload = predictions.map(p => ({
      ...p,
      isDouble: Boolean(p.isDouble)
    }));
    
    return this.http.post<any>(
      `${this.API_URL}/predictions/batch`,
      { predictions: payload },
      { headers: this.getHeaders() }
    );
  }

  // Submit single prediction
  submitPrediction(fixtureId: number, homeScore: number, awayScore: number, isDouble: boolean = false): Observable<any> {
    return this.createPrediction({ fixtureId, homeScore, awayScore, isDouble: Boolean(isDouble) });
  }

  // Get leaderboard
  getLeaderboard(): Observable<any> {
    return this.http.get<any>(
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