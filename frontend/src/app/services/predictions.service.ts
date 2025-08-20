import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
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
    return this.http.get<any>(`${this.apiUrl}/user`).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('Error fetching user predictions:', error);
        throw error;
      })
    );
  }

  getUserPredictionsByGameweek(gameweek: number): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/user/gameweek/${gameweek}`).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('Error fetching user predictions by gameweek:', error);
        throw error;
      })
    );
  }

  submitPrediction(prediction: PredictionRequest): Observable<Prediction> {
    return this.http.post<any>(this.apiUrl, prediction).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('Error submitting prediction:', error);
        throw error;
      })
    );
  }

  updatePrediction(id: number, prediction: PredictionRequest): Observable<Prediction> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, prediction).pipe(
      map(response => response.data || response),
      catchError(error => {
        console.error('Error updating prediction:', error);
        throw error;
      })
    );
  }

  deletePrediction(id: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`).pipe(
      map(() => {}),
      catchError(error => {
        console.error('Error deleting prediction:', error);
        throw error;
      })
    );
  }

  getLeaderboard(): Observable<LeaderboardEntry[]> {
    return this.http.get<any>(`${this.apiUrl}/leaderboard`).pipe(
      map(response => {
        console.log('Leaderboard API response:', response);
        return response.data || response || [];
      }),
      catchError(error => {
        console.error('Error fetching leaderboard:', error);
        throw error;
      })
    );
  }
}