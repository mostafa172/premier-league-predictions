import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Prediction, PredictionRequest, LeaderboardEntry } from '../models/prediction.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class PredictionsService {
  private apiUrl = 'http://localhost:3000/api/predictions';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  getUserPredictions(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/user`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.data || response)
    );
  }

  getUserPredictionsByGameweek(gameweek: number): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/user/gameweek/${gameweek}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.data || response)
    );
  }

  submitPrediction(prediction: PredictionRequest): Observable<Prediction> {
    return this.http.post<any>(this.apiUrl, prediction, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.data || response)
    );
  }

  updatePrediction(id: number, prediction: PredictionRequest): Observable<Prediction> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, prediction, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => response.data || response)
    );
  }

  deletePrediction(id: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(() => {})
    );
  }

  getLeaderboard(): Observable<LeaderboardEntry[]> {
    return this.http.get<any>(`${this.apiUrl}/leaderboard`, {
      headers: this.getAuthHeaders()
    }).pipe(
      map(response => {
        console.log('Leaderboard API response:', response);
        return response.data || response || [];
      })
    );
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }
}